import axios from "axios";
import crypto, { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { Agent } from "https";
import forge from "node-forge";
import jwt from "jsonwebtoken";

interface InvoiceData {
  dateTime: Date;
  issueDateTime: Date;
  numberingStructure: string;
  businessPremiseID: string;
  electronicDeviceID: string;
  invoiceNumber: number;
  invoiceAmount: number;
  paymentAmount: number;
  taxes: any[];
  operatorTaxNumber: string;
  costumerVatNumber?: string;
}

export function generateJSONInvoice(invoiceData: InvoiceData) {
  const ZOI = calculateZOI(
    process.env.BOLDERAJ_TAX_NUMBER!,
    invoiceData.issueDateTime.toISOString(),
    invoiceData.invoiceNumber,
    invoiceData.businessPremiseID,
    invoiceData.electronicDeviceID,
    invoiceData.invoiceAmount
  );

  const highTaxes = invoiceData.taxes.filter((tax) => tax.taxRate === 22);
  const lowTaxes = invoiceData.taxes.filter((tax) => tax.taxRate === 9.5);

  const highTaxTaxableAmount = parseFloat(
    highTaxes.reduce((c, tax) => c + tax.taxableAmount, 0).toFixed(2)
  );

  const highTaxAmount = parseFloat(
    highTaxes.reduce((c, tax) => c + tax.taxAmount, 0).toFixed(2)
  );

  const lowTaxTaxableAmount = parseFloat(
    lowTaxes.reduce((c, tax) => c + tax.taxableAmount, 0).toFixed(2)
  );

  const lowTaxAmount = parseFloat(
    lowTaxes.reduce((c, tax) => c + tax.taxAmount, 0).toFixed(2)
  );

  function generateTaxes() {
    if (highTaxes.length > 0 && lowTaxes.length === 0) {
      const VAT = [
        {
          TaxRate: parseFloat((22.0).toFixed(2)),
          TaxableAmount: highTaxTaxableAmount,
          TaxAmount: highTaxAmount,
        },
      ];

      return VAT;
    }

    if (lowTaxes.length > 0 && highTaxes.length === 0) {
      const VAT = [
        {
          TaxRate: parseFloat((9.5).toFixed(2)),
          TaxableAmount: lowTaxTaxableAmount,
          TaxAmount: lowTaxAmount,
        },
      ];

      return VAT;
    }

    if (highTaxes.length > 0 && lowTaxes.length > 0) {
      const VAT = [
        {
          TaxRate: parseFloat((9.5).toFixed(2)),
          TaxableAmount: lowTaxTaxableAmount,
          TaxAmount: lowTaxAmount,
        },
        {
          TaxRate: parseFloat((22.0).toFixed(2)),
          TaxableAmount: highTaxTaxableAmount,
          TaxAmount: highTaxAmount,
        },
      ];

      return VAT;
    }
  }

  const JSONInvoice = {
    InvoiceRequest: {
      Header: {
        MessageID: randomUUID(),
        DateTime: invoiceData.dateTime.toISOString().split(".")[0],
      },
      Invoice: {
        TaxNumber: Number(process.env.BOLDERAJ_TAX_NUMBER!),
        IssueDateTime: invoiceData.issueDateTime.toISOString().split(".")[0],
        NumberingStructure: invoiceData.numberingStructure,
        InvoiceIdentifier: {
          BusinessPremiseID: "PC1",
          ElectronicDeviceID: invoiceData.electronicDeviceID,
          InvoiceNumber: invoiceData.invoiceNumber.toString(),
        },
        InvoiceAmount: invoiceData.invoiceAmount,
        PaymentAmount: invoiceData.paymentAmount,
        TaxesPerSeller: [
          {
            VAT: generateTaxes(),
          },
        ],
        OperatorTaxNumber: Number(invoiceData.operatorTaxNumber),
        ProtectedID: ZOI,
      },
    },
  };

  return { JSONInvoice, ZOI };
}

export function calculateZOI(
  taxNumber: string,
  timestamp: string,
  invoiceNumber: number,
  businessPremiseID: string,
  deviceID: string,
  invoiceAmount: number
): string {
  const p12Buffer = readFileSync(`./certs/10622799-1.p12`);
  const p12Der = forge.util.decode64(p12Buffer.toString("base64"));
  const pkcs12Asn1 = forge.asn1.fromDer(p12Der);
  const pkcs12 = forge.pkcs12.pkcs12FromAsn1(
    pkcs12Asn1,
    false,
    process.env.CERTIFICATE_PASSWORD
  ); // 🔑 Geslo potrdila

  let map: any = {};
  let key: string;

  for (let sci = 0; sci < pkcs12.safeContents.length; ++sci) {
    let safeContents = pkcs12.safeContents[sci];

    for (let sbi = 0; sbi < safeContents.safeBags.length; ++sbi) {
      let safeBag = safeContents.safeBags[sbi];
      let localKeyId = null;

      if (safeBag.attributes.localKeyId) {
        localKeyId = forge.util.bytesToHex(safeBag.attributes.localKeyId[0]);

        if (!(localKeyId in map)) {
          map[localKeyId] = {
            privateKey: null,
            certChain: [],
          };
        }
      } else {
        continue;
      }

      if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
        map[localKeyId].privateKey = safeBag.key;
      } else if (safeBag.type === forge.pki.oids.certBag) {
        map[localKeyId].certChain.push(safeBag.cert);
      }
    }
  }

  for (let localKeyId in map) {
    let entry = map[localKeyId];

    if (entry.privateKey) {
      let privateKeyP12Pem = forge.pki.privateKeyToPem(entry.privateKey);
      key = privateKeyP12Pem;
    }
  }

  function formatDateForZOI(timestamp: string): string {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Meseci so od 0 do 11
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${day}.${month}.${year}${hours}:${minutes}:${seconds}`;
  }

  const date = formatDateForZOI(timestamp);

  const inputString = `${taxNumber}${date}${invoiceNumber}${businessPremiseID}${deviceID}${invoiceAmount.toFixed(
    2
  )}`;

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(inputString);
  sign.end();
  const signature = sign.sign(key!);

  // Izračunamo MD5 hash podpisa in ga pretvorimo v heksadecimalno obliko
  const ZOI = crypto.createHash("md5").update(signature).digest("hex");

  return ZOI;
}

export async function connectWithFURS(data: any) {
  const p12Buffer = readFileSync(`./certs/10622799-1.p12`);
  const p12Der = forge.util.decode64(p12Buffer.toString("base64"));
  const pkcs12Asn1 = forge.asn1.fromDer(p12Der);
  const pkcs12 = forge.pkcs12.pkcs12FromAsn1(
    pkcs12Asn1,
    false,
    process.env.CERTIFICATE_PASSWORD
  ); // 🔑 Geslo potrdila
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(
    p12Asn1,
    process.env.CERTIFICATE_PASSWORD
  );
  const bags = p12.getBags({ bagType: forge.pki.oids.certBag });

  const cert = bags[forge.pki.oids.certBag]![0];

  // Serial number
  function hexToDecimal(hex: string): string {
    return BigInt(`0x${hex}`).toString(10);
  }

  const hexValue = cert["cert"]!["serialNumber"];
  const serial = hexToDecimal(hexValue);

  let map: any = {};
  let key: string;

  for (let sci = 0; sci < pkcs12.safeContents.length; ++sci) {
    let safeContents = pkcs12.safeContents[sci];

    for (let sbi = 0; sbi < safeContents.safeBags.length; ++sbi) {
      let safeBag = safeContents.safeBags[sbi];
      let localKeyId = null;

      if (safeBag.attributes.localKeyId) {
        localKeyId = forge.util.bytesToHex(safeBag.attributes.localKeyId[0]);

        if (!(localKeyId in map)) {
          map[localKeyId] = {
            privateKey: null,
            certChain: [],
          };
        }
      } else {
        continue;
      }

      if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
        map[localKeyId].privateKey = safeBag.key;
      } else if (safeBag.type === forge.pki.oids.certBag) {
        map[localKeyId].certChain.push(safeBag.cert);
      }
    }
  }

  for (let localKeyId in map) {
    let entry = map[localKeyId];

    if (entry.privateKey) {
      let privateKeyP12Pem = forge.pki.privateKeyToPem(entry.privateKey);
      key = privateKeyP12Pem;
    }
  }

  const caCerts = [
    readFileSync("./certs/si-trust-root.pem"),
    readFileSync("./certs/sigov-ca2.xcert.pem"),
  ];
  const fursCert = readFileSync("./certs/blagajne-test.fu.gov.si.pem");
  const appCert = readFileSync("./certs/DavPotRacTEST.cer");
  const myCert = readFileSync("./certs/10622799-1.p12");

  const agent = new Agent({
    pfx: myCert,
    passphrase: process.env.CERTIFICATE_PASSWORD,
    ca: caCerts,
    rejectUnauthorized: true, // V produkciji nastavi na `true`
    minVersion: "TLSv1.2",
  });

  const header = {
    alg: "RS256",
    issuer_name: "",
    subject_name: "",
    serial,
  };

  const certCNs = {
    issuer_name: cert["cert"]!["issuer"],
    subject_name: cert["cert"]!["subject"],
  };
  const cnTypes = ["subject_name", "issuer_name"];

  cnTypes.forEach((t) => {
    //@ts-ignore
    const attributesList = certCNs[t].attributes.map((attr: any) => {
      const tName = attr.shortName ? "shortName" : "name";
      return `${attr[tName]}=${attr.value}`;
    });

    //@ts-ignore
    header[t] = attributesList.join(",");
  });

  const token = jwt.sign(data, key!, {
    header,
    algorithm: "RS256",
    noTimestamp: true,
  });

  const body = {
    token,
  };

  try {
    const res = await axios.post(`${process.env.FURS_URL!}/invoices`, body, {
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      httpsAgent: agent,
    });

    const { token } = res.data;

    const jsonRes: any = jwt.verify(token, appCert, {
      algorithms: ["RS256"],
    });

    const { UniqueInvoiceID: EOR } = jsonRes.InvoiceResponse;

    return EOR;
  } catch (error) {
    console.log(error);
  }
}

export async function bussinesPremises() {
  const p12Buffer = readFileSync(`./certs/10622799-1.p12`);
  const p12Der = forge.util.decode64(p12Buffer.toString("base64"));
  const pkcs12Asn1 = forge.asn1.fromDer(p12Der);
  const pkcs12 = forge.pkcs12.pkcs12FromAsn1(
    pkcs12Asn1,
    false,
    process.env.CERTIFICATE_PASSWORD
  ); // 🔑 Geslo potrdila
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(
    p12Asn1,
    process.env.CERTIFICATE_PASSWORD
  );
  const bags = p12.getBags({ bagType: forge.pki.oids.certBag });

  const cert = bags[forge.pki.oids.certBag]![0];

  // Serial number
  function hexToDecimal(hex: string): string {
    return BigInt(`0x${hex}`).toString(10);
  }

  const hexValue = cert["cert"]!["serialNumber"];
  const serial = hexToDecimal(hexValue);

  let map: any = {};
  let key: string;

  for (let sci = 0; sci < pkcs12.safeContents.length; ++sci) {
    let safeContents = pkcs12.safeContents[sci];

    for (let sbi = 0; sbi < safeContents.safeBags.length; ++sbi) {
      let safeBag = safeContents.safeBags[sbi];
      let localKeyId = null;

      if (safeBag.attributes.localKeyId) {
        localKeyId = forge.util.bytesToHex(safeBag.attributes.localKeyId[0]);

        if (!(localKeyId in map)) {
          map[localKeyId] = {
            privateKey: null,
            certChain: [],
          };
        }
      } else {
        continue;
      }

      if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
        map[localKeyId].privateKey = safeBag.key;
      } else if (safeBag.type === forge.pki.oids.certBag) {
        map[localKeyId].certChain.push(safeBag.cert);
      }
    }
  }

  for (let localKeyId in map) {
    let entry = map[localKeyId];

    if (entry.privateKey) {
      let privateKeyP12Pem = forge.pki.privateKeyToPem(entry.privateKey);
      key = privateKeyP12Pem;
    }
  }

  const caCerts = [
    readFileSync("./certs/si-trust-root.pem"),
    readFileSync("./certs/sigov-ca2.xcert.pem"),
  ];
  const fursCert = readFileSync("./certs/blagajne-test.fu.gov.si.pem");
  const appCert = readFileSync("./certs/DavPotRacTEST.cer");
  const myCert = readFileSync("./certs/10622799-1.p12");

  const agent = new Agent({
    pfx: myCert,
    passphrase: process.env.CERTIFICATE_PASSWORD,
    ca: caCerts,
    rejectUnauthorized: true, // V produkciji nastavi na `true`
    minVersion: "TLSv1.2",
  });

  const header = {
    alg: "RS256",
    issuer_name: "",
    subject_name: "",
    serial,
  };

  const certCNs = {
    issuer_name: cert["cert"]!["issuer"],
    subject_name: cert["cert"]!["subject"],
  };
  const cnTypes = ["subject_name", "issuer_name"];

  cnTypes.forEach((t) => {
    //@ts-ignore
    const attributesList = certCNs[t].attributes.map((attr: any) => {
      const tName = attr.shortName ? "shortName" : "name";
      return `${attr[tName]}=${attr.value}`;
    });

    //@ts-ignore
    header[t] = attributesList.join(",");
  });

  const premise = {
    BusinessPremiseRequest: {
      Header: {
        MessageID: randomUUID(),
        DateTime: new Date().toISOString().split(".")[0],
      },
      BusinessPremise: {
        TaxNumber: Number(process.env.BOLDERAJ_TAX_NUMBER!),
        BusinessPremiseID: "PC1",
        BPIdentifier: {
          RealEstateBP: {
            PropertyID: {
              CadastralNumber: 365,
              BuildingNumber: 12,
              BuildingSectionNumber: 3,
            },
            Address: {
              Street: "Tržaška cesta",
              HouseNumber: "24",
              Community: "Ljubljana",
              City: "Ljubljana",
              PostalCode: "1000",
            },
          },
        },
        // ValidityDate: moment().format('Y-MM-DD'),
        ValidityDate: new Date().toISOString().split(".")[0],
        SoftwareSupplier: [
          {
            TaxNumber: 12345678,
          },
        ],
      },
    },
  };

  const token = jwt.sign(premise, key!, {
    header,
    algorithm: "RS256",
    noTimestamp: true,
  });

  const body = {
    token,
  };

  try {
    const res = await axios.post(
      `${process.env.FURS_URL!}/invoices/register`,
      body,
      {
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
        },
        httpsAgent: agent,
      }
    );

    const { token } = res.data;

    console.log(
      jwt.verify(token, appCert, {
        algorithms: ["RS256"],
      })
    );

    return token;
  } catch (error) {
    console.log(error);
  }
}
