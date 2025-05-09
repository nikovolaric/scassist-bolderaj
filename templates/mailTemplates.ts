import mjml2html from "mjml";

export function generateGiftCodeMail(firstName: string, code: string) {
  const mjmlTemplate = `<mjml owa="desktop" version="4.3.0">
  <mj-head>
    <mj-font href="https://fonts.googleapis.com/css2?family=Source+Sans+3" name="SuorceSans"></mj-font>
    <mj-preview></mj-preview>
  </mj-head>
  <mj-body background-color="#f8f8f8">
    <mj-section background-color="#ffffff" background-repeat="repeat" padding-bottom="0px" padding-left="0px" padding-right="0px" padding-top="0px" padding="20px 0" text-align="center">
      <mj-column>
        <mj-divider border-color="#ffffff" border-style="solid" border-width="7px" padding-bottom="40px" padding-left="0px" padding-right="0px" padding-top="0px" padding="10px 25px" width="100%"></mj-divider>
        <mj-image align="center" alt="Logotip" border="none" padding-bottom="0px" padding-top="0px" padding="10px 25px" src="https://bolderaj.s3.eu-central-1.amazonaws.com/logo.png" target="_blank" height="auto" width="200x"></mj-image>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" background-repeat="repeat" background-size="auto" padding-bottom="0px" padding-top="0px" padding="20px 0" text-align="center">
      <mj-column>
        <mj-image align="center" alt="Grafika" border="none" height="auto" padding-bottom="0px" padding-left="50px" padding-right="50px" padding-top="40px" padding="10px 25px" src="https://bolderaj.s3.eu-central-1.amazonaws.com/visit.png" target="_blank" width="400px"></mj-image>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" background-repeat="repeat" background-size="auto" padding-bottom="70px" padding-top="30px" padding="20px 0px 20px 0px" text-align="center">
      <mj-column>
        <mj-text align="left" color="#797e82" font-size="13px" line-height="22px" padding-bottom="0px" padding-left="50px" padding-right="50px" padding-top="0px" padding="0px 25px 0px 25px">
          <h1 style="text-align:center; color: #000000; line-height:32px" font-family="SuorceSans, sans-serif">Živijo<i style="font-style:italic"> </i>${firstName},</h1>
          <h1 style="text-align:center; color: #000000; line-height:32px" font-family="SuorceSans, sans-serif">tvoja darilna koda je<i style="font-style:italic"> </i>${code}</h1>
        </mj-text>
        <mj-text align="left" color="#797e82" font-size="13px" line-height="22px" padding-bottom="0px" padding-left="50px" padding-right="50px" padding-top="0px" padding="0px 25px 0px 25px" font-family="SuorceSans, sans-serif">
          <p style="margin: 10px 0; text-align: center;">V priponki najdeš darilni bon v elektronski obliki, ki ga lahko natisneš in izpolniš.</p>
          <p style="margin: 10px 0; text-align: center;">Darilni bon velja eno leto od dneva nakupa.</p>
          <p style="margin: 10px 0; text-align: center;">Več o pogojih vnovčitve darilnih bonov si lahko prebereš na <a href="${process.env.FRONTEND_URL}/terms-conditions">povezavi.</a></p>
          <p style="margin: 10px 0; text-align: center;">Hvala za vaš nakup!</p>
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

  const { html } = mjml2html(mjmlTemplate);

  return html;
}

export function generatePasswordResetMail(token: string) {
  const mjmlTemplate = `<mjml owa="desktop" version="4.3.0">
  <mj-head>
    <mj-font href="https://fonts.googleapis.com/css2?family=Source+Sans+3" name="SuorceSans"></mj-font>
    <mj-preview></mj-preview>
  </mj-head>
  <mj-body background-color="#f8f8f8">
    <mj-section background-color="#ffffff" background-repeat="repeat" padding-bottom="0px" padding-left="0px" padding-right="0px" padding-top="0px" padding="20px 0" text-align="center">
      <mj-column>
        <mj-divider border-color="#ffffff" border-style="solid" border-width="7px" padding-bottom="40px" padding-left="0px" padding-right="0px" padding-top="0px" padding="10px 25px" width="100%"></mj-divider>
        <mj-image align="center" alt="Logotip" border="none" padding-bottom="0px" padding-top="0px" padding="10px 25px" src="https://bolderaj.s3.eu-central-1.amazonaws.com/logo.png" target="_blank" height="auto" width="200px"></mj-image>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" background-repeat="repeat" background-size="auto" padding-bottom="0px" padding-top="0px" padding="20px 0" text-align="center">
      <mj-column>
        <mj-image align="center" alt="Grafika" border="none" height="auto" padding-bottom="0px" padding-left="50px" padding-right="50px" padding-top="40px" padding="10px 25px" src="https://bolderaj.s3.eu-central-1.amazonaws.com/visit.png" target="_blank" width="400px"></mj-image>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" background-repeat="repeat" background-size="auto" padding-bottom="70px" padding-top="30px" padding="20px 0px 20px 0px" text-align="center">
      <mj-column>
        <mj-text align="left" color="#797e82" font-size="13px" line-height="22px" padding-bottom="0px" padding-left="50px" padding-right="50px" padding-top="0px" padding="0px 25px 0px 25px">
          <h1 style="text-align:center; color: #000000; line-height:32px" font-family="SuorceSans, sans-serif">Živijo,</h1>
          <h1 style="text-align:center; color: #000000; line-height:20px; font-size:16px; font-weight:400;" font-family="SuorceSans, sans-serif">geslo lahko v naslednjih 10 minutah ponastaviš na spodnji povezavi!</h1>
        </mj-text>
        <mj-button background-color="#ffde00" color="#000000" font-weight="600" href="${process.env.FRONTEND_URL}/resetpassword/${token}">Ponastavi tukaj</mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

  const { html } = mjml2html(mjmlTemplate);

  return html;
}

export function generateChildAuthMail(token: string) {
  const mjmlTemplate = `<mjml owa="desktop" version="4.3.0">
  <mj-head>
    <mj-font href="https://fonts.googleapis.com/css2?family=Source+Sans+3" name="SuorceSans"></mj-font>
    <mj-preview></mj-preview>
  </mj-head>
  <mj-body background-color="#f8f8f8">
    <mj-section background-color="#ffffff" background-repeat="repeat" padding-bottom="0px" padding-left="0px" padding-right="0px" padding-top="0px" padding="20px 0" text-align="center">
      <mj-column>
        <mj-divider border-color="#ffffff" border-style="solid" border-width="7px" padding-bottom="40px" padding-left="0px" padding-right="0px" padding-top="0px" padding="10px 25px" width="100%"></mj-divider>
        <mj-image align="center" alt="Logotip" border="none" padding-bottom="0px" padding-top="0px" padding="10px 25px" src="https://bolderaj.s3.eu-central-1.amazonaws.com/logo.png" target="_blank" height="auto" width="200px"></mj-image>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" background-repeat="repeat" background-size="auto" padding-bottom="0px" padding-top="0px" padding="20px 0" text-align="center">
      <mj-column>
        <mj-image align="center" alt="Grafika" border="none" height="auto" padding-bottom="0px" padding-left="50px" padding-right="50px" padding-top="40px" padding="10px 25px" src="https://bolderaj.s3.eu-central-1.amazonaws.com/visit.png" target="_blank" width="400px"></mj-image>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" background-repeat="repeat" background-size="auto" padding-bottom="70px" padding-top="30px" padding="20px 0px 20px 0px" text-align="center">
      <mj-column>
        <mj-text align="left" color="#797e82" font-size="13px" line-height="22px" padding-bottom="0px" padding-left="50px" padding-right="50px" padding-top="0px" padding="0px 25px 0px 25px">
          <h1 style="text-align:center; color: #000000; line-height:32px" font-family="SuorceSans, sans-serif">Živijo,</h1>
          <h1 style="text-align:center; color: #000000; line-height:20px; font-size:16px; font-weight:400;" font-family="SuorceSans, sans-serif">v naslednjih 10 minutah lahko na spodnji povezavi nastaviš svoje vpisne podatke.</h1>
        </mj-text>
        <mj-button background-color="#ffde00" color="#000000" font-weight="600" href="${process.env.FRONTEND_URL}/setchildauth/${token}">Nastavi tukaj</mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

  const { html } = mjml2html(mjmlTemplate);

  return html;
}

export function generateWelcomeConfirmEmailMail(token: string) {
  const mjmlTemplate = `<mjml owa="desktop" version="4.3.0">
  <mj-head>
    <mj-font href="https://fonts.googleapis.com/css2?family=Source+Sans+3" name="SuorceSans"></mj-font>
    <mj-preview></mj-preview>
  </mj-head>
  <mj-body background-color="#f8f8f8">
    <mj-section background-color="#ffffff" background-repeat="repeat" padding-bottom="0px" padding-left="0px" padding-right="0px" padding-top="0px" padding="20px 0" text-align="center">
      <mj-column>
        <mj-divider border-color="#ffffff" border-style="solid" border-width="7px" padding-bottom="40px" padding-left="0px" padding-right="0px" padding-top="0px" padding="10px 25px" width="100%"></mj-divider>
        <mj-image align="center" alt="Logotip" border="none" padding-bottom="0px" padding-top="0px" padding="10px 25px" src="https://bolderaj.s3.eu-central-1.amazonaws.com/logo.png" target="_blank" height="auto" width="200px"></mj-image>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" background-repeat="repeat" background-size="auto" padding-bottom="0px" padding-top="0px" padding="20px 0" text-align="center">
      <mj-column>
        <mj-image align="center" alt="Grafika" border="none" height="auto" padding-bottom="0px" padding-left="50px" padding-right="50px" padding-top="40px" padding="10px 25px" src="https://bolderaj.s3.eu-central-1.amazonaws.com/visit.png" target="_blank" width="400px"></mj-image>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" background-repeat="repeat" background-size="auto" padding-bottom="70px" padding-top="30px" padding="20px 0px 20px 0px" text-align="center">
      <mj-column>
        <mj-text align="left" color="#797e82" font-size="13px" line-height="22px" padding-bottom="0px" padding-left="50px" padding-right="50px" padding-top="0px" padding="0px 25px 0px 25px">
          <h1 style="text-align:center; color: #000000; line-height:32px" font-family="SuorceSans, sans-serif">Živijo,</h1>
          <h1 style="text-align:center; color: #000000; line-height:20px; font-size:16px; font-weight:400;" font-family="SuorceSans, sans-serif">tvoja registracija je že skoraj dokončana. Za zaključek postopka potrdi svoj elektronski naslov s klikom na spodnji gumb. Povezava je aktivna 24ur.</h1>
        </mj-text>
        <mj-button background-color="#ffde00" color="#000000" font-weight="600" href="${process.env.FRONTEND_URL}/confirmmail/${token}">Potrdi elektronski naslov</mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

  const { html } = mjml2html(mjmlTemplate);

  return html;
}

export function generateNewConfirmEmailMail(token: string) {
  const mjmlTemplate = `<mjml owa="desktop" version="4.3.0">
  <mj-head>
    <mj-font href="https://fonts.googleapis.com/css2?family=Source+Sans+3" name="SuorceSans"></mj-font>
    <mj-preview></mj-preview>
  </mj-head>
  <mj-body background-color="#f8f8f8">
    <mj-section background-color="#ffffff" background-repeat="repeat" padding-bottom="0px" padding-left="0px" padding-right="0px" padding-top="0px" padding="20px 0" text-align="center">
      <mj-column>
        <mj-divider border-color="#ffffff" border-style="solid" border-width="7px" padding-bottom="40px" padding-left="0px" padding-right="0px" padding-top="0px" padding="10px 25px" width="100%"></mj-divider>
        <mj-image align="center" alt="Logotip" border="none" padding-bottom="0px" padding-top="0px" padding="10px 25px" src="https://bolderaj.s3.eu-central-1.amazonaws.com/logo.png" target="_blank" height="auto" width="200px"></mj-image>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" background-repeat="repeat" background-size="auto" padding-bottom="0px" padding-top="0px" padding="20px 0" text-align="center">
      <mj-column>
        <mj-image align="center" alt="Grafika" border="none" height="auto" padding-bottom="0px" padding-left="50px" padding-right="50px" padding-top="40px" padding="10px 25px" src="https://bolderaj.s3.eu-central-1.amazonaws.com/visit.png" target="_blank" width="400px"></mj-image>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" background-repeat="repeat" background-size="auto" padding-bottom="70px" padding-top="30px" padding="20px 0px 20px 0px" text-align="center">
      <mj-column>
        <mj-text align="left" color="#797e82" font-size="13px" line-height="22px" padding-bottom="0px" padding-left="50px" padding-right="50px" padding-top="0px" padding="0px 25px 0px 25px">
          <h1 style="text-align:center; color: #000000; line-height:32px" font-family="SuorceSans, sans-serif">Živijo,</h1>
          <h1 style="text-align:center; color: #000000; line-height:20px; font-size:16px; font-weight:400;" font-family="SuorceSans, sans-serif">s klikom na spodnji gumb potrdite svoj elektronski naslov. Povezava je aktivna 24ur.</h1>
        </mj-text>
        <mj-button background-color="#ffde00" color="#000000" font-weight="600" href="${process.env.FRONTEND_URL}/confirmmail/${token}">Potrdi elektronski naslov</mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

  const { html } = mjml2html(mjmlTemplate);

  return html;
}
