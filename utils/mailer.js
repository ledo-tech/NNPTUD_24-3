const nodemailer = require("nodemailer");

function getMailtrapConfig() {
  return {
    host: process.env.MAILTRAP_HOST || "sandbox.smtp.mailtrap.io",
    port: Number.parseInt(process.env.MAILTRAP_PORT || "2525", 10),
    secure: false,
    auth: {
      user: process.env.MAILTRAP_USER || "",
      pass: process.env.MAILTRAP_PASS || "",
    },
  };
}

const transporter = nodemailer.createTransport(getMailtrapConfig());

module.exports = {
  transporter,
};

