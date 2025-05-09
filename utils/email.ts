import { createTransport, TransportOptions } from "nodemailer";
import {
  generateInvoiceMail,
  generateInvoicePDFBuffer,
} from "../templates/sendInvoiceTemplate";
import {
  generatePreInvoiceMail,
  generatePreInvoicePDFBuffer,
} from "../templates/sendPreInvoiceTemplate";
import {
  generateChildAuthMail,
  generateGiftCodeMail,
  generateNewConfirmEmailMail,
  generatePasswordResetMail,
  generateWelcomeConfirmEmailMail,
} from "../templates/mailTemplates";

export async function sendInvoice(options: any) {
  //1. Create transporter

  const transporter = createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  } as TransportOptions);

  const invoiceData = {
    invoice_number: options.invoiceNumber,
    invoice_date: options.invoiceDate,
    completed_date: options.invoiceCompletionDate,
    company_name: options.companyName,
    issuer: options.cashier,
    reference_number: options.reference,
    customer_name: options.name,
    customer_address: options.address,
    customer_postalCode: options.postalCode,
    custumer_city: options.city,
    tax_number: options.taxNumber,
    total_with_tax: options.totalAmount,
    vat_amount: options.totalTaxAmount,
    payment_method: options.paymentMethod,
    due_date: options.dueDate,
    items: options.items,
    ZOI: options.ZOI,
    EOR: options.EOR,
  };

  //MJML to HTML
  const html = generateInvoiceMail(invoiceData);

  //generiraj PDF
  const pdfBuffer = await generateInvoicePDFBuffer(invoiceData);

  //2. Define the email options
  const mailOptions = {
    from: `Bolderaj <${process.env.EMAIL_USERNAME}>`,
    to: options.email,
    subject: `Račun ${options.invoiceNumber}`,
    html,
    attachments: [
      {
        filename: `Racun_${invoiceData.invoice_number}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  };
  //3. Actually send the email
  await transporter.sendMail(mailOptions);
}

export async function sendPreInvoice(options: any) {
  //1. Create transporter

  const transporter = createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  } as TransportOptions);

  const preInvoiceData = {
    invoice_number: options.preInvoiceNumber,
    invoice_date: options.invoiceDate,
    company_name: options.companyName,
    reference_number: options.reference,
    customer_name: options.name,
    customer_address: options.address,
    customer_postalCode: options.postalCode,
    customer_city: options.city,
    tax_number: options.taxNumber,
    total_with_tax: options.totalAmount,
    vat_amount: options.taxAmount,
    payment_method: options.paymentMethod,
    due_date: options.dueDate,
    items: options.items,
  };

  //MJML to HTML
  const html = generatePreInvoiceMail(preInvoiceData);

  //generiraj PDF
  const pdfBuffer = await generatePreInvoicePDFBuffer(preInvoiceData);

  //2. Define the email options
  const mailOptions = {
    from: `Bolderaj <${process.env.EMAIL_USERNAME}>`,
    to: options.email,
    subject: `Predračun ${options.preInvoiceNumber}`,
    html,
    attachments: [
      {
        filename: `Predracun_${preInvoiceData.invoice_number}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  };
  //3. Actually send the email
  await transporter.sendMail(mailOptions);
}

export const sendReset = async function (options: any) {
  //1. Create transporter
  const transporter = createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  } as TransportOptions);

  const html = generatePasswordResetMail(options.token);

  //2. Define the email options
  const mailOptions = {
    from: `Bolderaj <${process.env.EMAIL_USERNAME}>`,
    to: options.email,
    subject: "Obnovite geslo na spodnji povezavi",
    html,
  };
  //3. Actually send the email
  await transporter.sendMail(mailOptions);
};

export const sendCode = async function (options: any) {
  //1. Create transporter
  const transporter = createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  } as TransportOptions);

  const html = generateGiftCodeMail(options.firstName, options.code);

  //2. Define the email options
  const mailOptions = {
    from: `Bolderaj <${process.env.EMAIL_USERNAME}>`,
    to: options.email,
    subject: "Darilna koda",
    html,
  };

  //3. Actually send the email
  await transporter.sendMail(mailOptions);
};

export const sendChildAuth = async function (options: any) {
  //1. Create transporter
  const transporter = createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  } as TransportOptions);

  const html = generateChildAuthMail(options.token);

  //2. Define the email options
  const mailOptions = {
    from: `Bolderaj <${process.env.EMAIL_USERNAME}>`,
    to: options.email,
    subject: "Nastavite svoje vpisne podatke na spodnji povezavi",
    html,
  };
  //3. Actually send the email
  await transporter.sendMail(mailOptions);
};

export const sendWelcomeConfirmMail = async function (options: any) {
  //1. Create transporter
  const transporter = createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  } as TransportOptions);

  const html = generateWelcomeConfirmEmailMail(options.token);

  //2. Define the email options
  const mailOptions = {
    from: `Bolderaj <${process.env.EMAIL_USERNAME}>`,
    to: options.email,
    subject: "Potrdite svoj elektronski naslov",
    html,
  };
  //3. Actually send the email
  await transporter.sendMail(mailOptions);
};

export const sendAnotherConfirmMail = async function (options: any) {
  //1. Create transporter
  const transporter = createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  } as TransportOptions);

  const html = generateNewConfirmEmailMail(options.token);

  //2. Define the email options
  const mailOptions = {
    from: `Bolderaj <${process.env.EMAIL_USERNAME}>`,
    to: options.email,
    subject: "Potrdite svoj elektronski naslov",
    html,
  };
  //3. Actually send the email
  await transporter.sendMail(mailOptions);
};
