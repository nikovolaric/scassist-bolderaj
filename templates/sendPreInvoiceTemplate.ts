import mjml2html from "mjml";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

export function generatePreInvoiceMail(invoiceData: any) {
  const itemsHtml = invoiceData.items
    .map(
      (item: {
        item: string;
        quantity: number;
        taxableAmount: number;
        amountWithTax: number;
        taxRate: number;
      }) => {
        return `
      <tr>
        <td align="left">${item.item}</td>
        <td align="left">${item.quantity}</td>
        <td align="right">${item.taxRate * 100}%</td>
        <td align="right">${(item.amountWithTax * item.quantity).toFixed(
          2
        )} €</td>
      </tr>
      `;
      }
    )
    .join("");

  const smallTaxItems = invoiceData.items.filter(
    (item: { taxRate: number }) => item.taxRate === 0.095
  );

  const bigTaxItems = invoiceData.items.filter(
    (item: { taxRate: number }) => item.taxRate === 0.22
  );

  function taxableAmount(arr: { taxableAmount: number; quantity: number }[]) {
    return arr
      .reduce(
        (a: number, c: { taxableAmount: number; quantity: number }) =>
          a + c.taxableAmount * c.quantity,
        0
      )
      .toFixed(2);
  }

  function taxAmount(
    arr: { amountWithTax: number; taxableAmount: number; quantity: number }[]
  ) {
    return arr
      .reduce(
        (
          a: number,
          c: { amountWithTax: number; taxableAmount: number; quantity: number }
        ) => a + (c.amountWithTax - c.taxableAmount) * c.quantity,
        0
      )
      .toFixed(2);
  }

  const mjmlTemplate = `
<mjml>
  <mj-head>
    <mj-preview>Predračun št. ${invoiceData.invoice_number}</mj-preview>
  </mj-head>

  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text align="center" font-size="20px" font-weight="bold">Predračun</mj-text>
        <mj-text align="center" padding="3px">Št. predračuna: ${
          invoiceData.invoice_number
        }</mj-text>
        <mj-text align="center" padding="3px">Datum izdaje: ${invoiceData.invoice_date.toLocaleDateString(
          "sl-SI",
          {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }
        )}</mj-text>
         <mj-text align="center" padding="3px">Kraj izdaje: Bolderaj d.o.o., PE Plezalni center, Popovičeva ulica 2, 3000 Celje</mj-text>
        <mj-text align="center" padding="3px">Sklic: ${
          invoiceData.reference_number
        }</mj-text>
       </mj-column>
    </mj-section>

    <mj-section>
      <mj-column>
        <mj-text font-size="18px" font-weight="bold">Podatki za plačilo</mj-text>
        <mj-text padding-top="3px" padding-bottom="3px">Bolderaj d.o.o.</mj-text>
        <mj-text padding-top="3px" padding-bottom="3px">Ob progi 3</mj-text>
        <mj-text padding-top="3px" padding-bottom="3px">3250 Rogaška Slatina</mj-text>
        <mj-text padding-top="3px" padding-bottom="3px">SI${
          process.env.BOLDERAJ_TAX_NUMBER
        }</mj-text>
         <mj-text padding-top="3px" padding-bottom="3px">TRR: ${
           process.env.BOLDERAJ_TRR
         } (OTP banka d.d.)</mj-text>
      </mj-column>
    </mj-section>

    <mj-section>
      <mj-column>
        <mj-text font-size="18px" font-weight="bold">Podatki o plačniku</mj-text>
               <mj-text padding-top="3px" padding-bottom="3px">${
                 invoiceData.company_name
                   ? invoiceData.company_name
                   : invoiceData.customer_name
               }</mj-text>
        ${
          invoiceData.customer_address
            ? `<mj-text padding-top="3px" padding-bottom="3px">${invoiceData.customer_address}</mj-text>`
            : ""
        }
        ${
          invoiceData.customer_postalCode && invoiceData.customer_city
            ? `<mj-text padding-top="3px" padding-bottom="3px">${invoiceData.customer_postalCode} ${invoiceData.customer_city}</mj-text>`
            : ""
        }
        ${
          invoiceData.tax_number
            ? `<mj-text padding-top="3px" padding-bottom="3px">ID za DDV: ${invoiceData.tax_number}</mj-text>`
            : ""
        }
      </mj-column>
    </mj-section>

    <!-- Desktop verzija -->
    <mj-raw>
      <!--[if !mso]><!-->
    </mj-raw>
    <mj-section>
      <mj-column>
        <mj-text align="center" font-size="18px" font-weight="bold">Podrobnosti o nakupu</mj-text>
        <mj-table padding="30px 24px">
          <tr>
            <th align="left">Opis</th>
            <th align="left">Količina</th>
            <th align="right">DDV %</th>
            <th align="right">Skupaj</th>
          </tr>
          ${itemsHtml}
          <tr>
            <th align="left" colspan="2">Davčna stopnja</th>
            <th align="right">Osnova</th>
            <th align="right">Znesek DDV</th>
          </tr>
          <tr>
          ${
            smallTaxItems.length > 0
              ? `<td align="left" colspan="2">9.5%</td>
            <td align="right">${taxableAmount(smallTaxItems)} €</td>
            <td align="right">${taxAmount(smallTaxItems)} €</td>`
              : ""
          }
          </tr>
          <tr>
          ${
            bigTaxItems.length > 0
              ? `<td align="left" colspan="2">22%</td>
            <td align="right">${taxableAmount(bigTaxItems)} €</td>
            <td align="right">${taxAmount(bigTaxItems)} €</td>`
              : ""
          }
          </tr>
       </mj-table>
      </mj-column>
    </mj-section>
    <mj-section padding-top="0">
      <mj-column>
        <mj-text align="right" font-weight="bold">Skupni znesek (z DDV): ${invoiceData.total_with_tax.toFixed(
          2
        )} €</mj-text>
      </mj-column>
    </mj-section> 
    <mj-section padding-top="0">
      <mj-column>
        <mj-text align="left">Pri plačilu navedite referenco ${
          invoiceData.reference_number
        }</mj-text>
      </mj-column>
    </mj-section>
   
    <mj-section>
      <mj-column>
        <mj-text align="center" font-size="16px">Želimo ti prijetno plezanje!</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
  `;

  const { html } = mjml2html(mjmlTemplate);
  return html;
}

export function generatePreInvoicePDFBuffer(invoiceData: any): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const buffers: Buffer[] = [];

    const qrData = generateUPNQR(
      invoiceData.customer_name,
      invoiceData.customer_address,
      invoiceData.customer_postalCode,
      invoiceData.customer_city,
      invoiceData.total_with_tax.toFixed(2),
      invoiceData.reference_number
    );

    const qrCode = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: "M",
      version: 15,
    });

    doc.registerFont("SourceSans3", "./fonts/SourceSans3-Regular.ttf");
    doc.registerFont("SourceSans3Bold", "./fonts/SourceSans3-Bold.ttf");
    doc.font("SourceSans3");

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    doc
      .image("./templates/assets/logo.png", 50, 50, { width: 100 })
      .fillColor("#444444")
      .fontSize(10)
      .font("SourceSans3Bold")
      .text("Bolderaj, športne dejavnosti in storitve, d.o.o.", 200, 50, {
        align: "right",
      })
      .font("SourceSans3")
      .text("Ob progi 3", 200, 65, { align: "right" })
      .text("3250 Rogaška Slatina", 200, 80, { align: "right" })
      .text(`ID za DDV: SI${process.env.BOLDERAJ_TAX_NUMBER}`, 200, 95, {
        align: "right",
      })
      .text(`TRR: ${process.env.BOLDERAJ_TRR}`, 200, 110, {
        align: "right",
      })
      .font("SourceSans3Bold")
      .text("Bolderaj d.o.o., PE Plezalni center", 200, 140, { align: "right" })
      .font("SourceSans3")
      .text("Popovičeva ulica 2", 200, 155, { align: "right" })
      .text("3000 Celje", 200, 170, { align: "right" })
      .moveDown();

    doc
      .font("SourceSans3Bold")
      .text(
        invoiceData.company_name
          ? invoiceData.company_name
          : invoiceData.customer_name,
        50,
        100
      )
      .text(
        invoiceData.customer_address ? invoiceData.customer_address : "",
        50,
        100 + 15
      )
      .text(
        invoiceData.customer_postalCode && invoiceData.customer_city
          ? `${invoiceData.customer_postalCode} ${invoiceData.customer_city}`
          : "",
        50,
        100 + 30
      )
      .moveDown();

    if (invoiceData.tax_number) {
      doc.text(
        `${
          invoiceData.tax_number.startsWith("SI")
            ? "ID za DDV"
            : "Davčna številka"
        }: ${invoiceData.tax_number}`,
        50,
        100 + 45
      );
    }

    doc.fillColor("#444444").fontSize(20).text("Predračun", 50, 180);

    generateHr(doc, 205);

    const payment =
      invoiceData.payment_method === "nakazilo"
        ? "Bančna transakcija"
        : invoiceData.payment_method === "gotovina"
        ? "Gotovina"
        : invoiceData.payment_method === "card"
        ? "Bančna kartica"
        : "Spletno plačilo";

    doc
      .fontSize(10)
      .text("Številka predračuna:", 50, 220)
      .font("SourceSans3Bold")
      .text(invoiceData.invoice_number, 170, 220)
      .font("SourceSans3")
      .text("Datum Izdaje:", 50, 220 + 15)
      .text(
        invoiceData.invoice_date.toLocaleDateString("sl-SI", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }),
        170,
        220 + 15
      )
      .text("Rok plačila:", 50, 220 + 30)
      .text(
        invoiceData.due_date.toLocaleDateString("sl-SI", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }),
        170,
        220 + 30
      )
      .text("Sklic:", 50, 220 + 45)
      .text(invoiceData.reference_number, 170, 220 + 45)
      .moveDown();

    doc.font("SourceSans3Bold");

    const rowTop = 300;

    generateTableRow(doc, rowTop, "Opis", "Količina", "DDV %", "Skupaj");

    generateHr(doc, rowTop + 15);

    doc.font("SourceSans3");
    invoiceData.items.forEach(
      (
        el: {
          item: string;
          quantity: number;
          taxableAmount: number;
          amountWithTax: number;
          taxRate: number;
        },
        i: number
      ) => {
        const position = rowTop + (i + 1) * 15 + 15;
        generateTableRow(
          doc,
          position,
          el.item,
          el.quantity,
          el.taxRate * 100,
          `${(el.amountWithTax * el.quantity).toFixed(2)} €`
        );
      }
    );

    doc.font("SourceSans3Bold");

    generateTableRow(
      doc,
      rowTop + (invoiceData.items.length + 1) * 30,
      "Davčna stopnja",
      "",
      "Osnova",
      "Znesek DDV"
    );

    generateHr(doc, rowTop + (invoiceData.items.length + 1) * 30 + 15);

    doc.font("SourceSans3");

    const smallTaxItems = invoiceData.items.filter(
      (item: { taxRate: number }) => item.taxRate === 0.095
    );

    const bigTaxItems = invoiceData.items.filter(
      (item: { taxRate: number }) => item.taxRate === 0.22
    );

    function taxableAmount(arr: { taxableAmount: number; quantity: number }[]) {
      return arr
        .reduce(
          (a: number, c: { taxableAmount: number; quantity: number }) =>
            a + c.taxableAmount * c.quantity,
          0
        )
        .toFixed(2);
    }

    function taxAmount(
      arr: { amountWithTax: number; taxableAmount: number; quantity: number }[]
    ) {
      return arr
        .reduce(
          (
            a: number,
            c: {
              amountWithTax: number;
              taxableAmount: number;
              quantity: number;
            }
          ) => a + (c.amountWithTax - c.taxableAmount) * c.quantity,
          0
        )
        .toFixed(2);
    }

    if (smallTaxItems.length > 0) {
      generateTableRow(
        doc,
        rowTop + (invoiceData.items.length + 1) * 30 + 25,
        "9.5%",
        "",
        `${taxableAmount(smallTaxItems)} €`,
        `${taxAmount(smallTaxItems)} €`
      );
    }

    const bigTaxMargin = smallTaxItems.length > 0 ? 40 : 25;

    if (bigTaxItems.length > 0) {
      generateTableRow(
        doc,
        rowTop + (invoiceData.items.length + 1) * 30 + bigTaxMargin,
        "22%",
        "",
        `${taxableAmount(bigTaxItems)} €`,
        `${taxAmount(bigTaxItems)} €`
      );
    }

    doc.moveDown();

    doc.font("SourceSans3Bold");

    const totalRow =
      rowTop + (invoiceData.items.length + 1) * 40 + bigTaxMargin + 40;

    doc
      .text(
        `Skupni znesek (z DDV): ${invoiceData.total_with_tax.toFixed(2)} €`,
        0,
        totalRow,
        { align: "right" }
      )
      .text(
        `Pri plačilu navedite referenco ${invoiceData.reference_number}`,
        50,
        totalRow + 40
      )
      .text("Slikaj in plačaj s QR kodo", 410, totalRow + 210)
      .image(qrCode, 400, totalRow + 70, {
        width: 136,
        height: 136,
      })
      .moveDown();

    doc.font("SourceSans3");

    doc.text("Želimo ti prijetno plezanje!", 0, 740, {
      align: "center",
    });

    // Zaključek
    doc.end();
  });
}

function generateHr(doc: any, y: number) {
  doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
}

function generateTableRow(
  doc: any,
  y: number,
  c1: string,
  c2: number | string,
  c3: number | string,
  c4: number | string
) {
  doc
    .fontSize(10)
    .text(c1, 50, y)
    .text(c2, 280, y, { width: 90, align: "right" })
    .text(c3, 350, y, { width: 90, align: "right" })
    .text(c4, 0, y, { align: "right" });
}

function generateUPNQR(
  recepient: string,
  recepientAddress: string,
  recepientPostal: string,
  recepientCity: string,
  amount: string,
  reference: string
) {
  const qrStrNoCtrl = `UPNQR
  
  
  
  
${recepient}
${recepientAddress}
${recepientPostal} ${recepientCity}
${amount.replace(".", "").padStart(11, "0")}
    
    
GDSV
Plačilo predračuna ${reference}
 
${process.env.BOLDERAJ_TRR}
${reference.replace(" ", "")}
Bolderaj, športne dejavnosti in storitve, d.o.o.
${process.env.BOLDERAJ_ADDRESS}
${process.env.BOLDERAJ_POSTAL}`;

  const qrStrCtrl = `${qrStrNoCtrl}\n${qrStrNoCtrl.length + 1}`;

  return `${qrStrCtrl}`;
}
