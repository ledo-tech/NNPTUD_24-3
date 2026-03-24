const path = require("path");
const { transporter } = require("./mailer");

module.exports = {
  sendImportReportMail: async function (to, originalName, xlsxPath, summary) {
    await transporter.sendMail({
      from: "admin@haha.com",
      to,
      subject: "Import users report (xlsx attached)",
      text: `Import done.\n${summary}\n`,
      html: `<p>Import done.</p><pre>${summary}</pre>`,
      attachments: [
        {
          filename: originalName || path.basename(xlsxPath),
          path: xlsxPath,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    });
  },
};

