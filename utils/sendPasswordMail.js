const { transporter } = require("./mailer");

function escapeHtml(unsafe) {
  return String(unsafe)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

module.exports = {
  sendPasswordMail: async function (to, username, password) {
    const safeUser = escapeHtml(username);
    const safePass = escapeHtml(password);

    await transporter.sendMail({
      from: "admin@haha.com",
      to,
      subject: "Thong tin tai khoan",
      text: `Username: ${username}\nPassword: ${password}\n`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <div style="margin-bottom:12px">
            <img
              src="https://i.sstatic.net/l60Hf.png"
              alt="Logo"
              style="max-width:160px;height:auto;display:block"
            />
          </div>
          <h3 style="margin:0 0 8px 0">Thong tin tai khoan</h3>
          <p style="margin:0">Username: <b>${safeUser}</b></p>
          <p style="margin:0">Password: <b>${safePass}</b></p>
        </div>
      `,
    });
  },
};

