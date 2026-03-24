var express = require("express");
var router = express.Router();
let bcrypt = require('bcrypt')
let userModel = require("../schemas/users");
let { validatedResult, CreateAnUserValidator, ModifyAnUserValidator } = require('../utils/validator')
let userController = require('../controllers/users')
let { CheckLogin, checkRole } = require('../utils/authHandler')
let { uploadExcel } = require('../utils/uploadHandler')
let exceljs = require('exceljs')
let crypto = require('crypto')
let fs = require('fs')
let roleModel = require('../schemas/roles')
let { sendPasswordMail } = require('../utils/sendPasswordMail')
let { sendImportReportMail } = require('../utils/sendImportReportMail')

function randomPassword16() {
  // 12 bytes -> base64url = 16 chars
  try {
    return crypto.randomBytes(12).toString('base64url')
  } catch (e) {
    return crypto.randomBytes(16).toString('hex').slice(0, 16)
  }
}

async function parseUsersXlsx(pathFile) {
  let workbook = new exceljs.Workbook();
  await workbook.xlsx.readFile(pathFile)
  let worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(1);
  const headerMap = new Map();
  headerRow.eachCell((cell, colNumber) => {
    const key = String(cell.value || '').trim().toLowerCase()
    if (key) headerMap.set(key, colNumber)
  })
  const colUsername = headerMap.get('username')
  const colEmail = headerMap.get('email')
  if (!colUsername || !colEmail) {
    throw new Error("XLSX must have header 'username' and 'email' in row 1")
  }

  const rows = []
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r)
    const username = String(row.getCell(colUsername).value || '').trim()
    const email = String(row.getCell(colEmail).value || '').trim().toLowerCase()
    if (username && email) rows.push({ username, email, row: r })
  }
  return rows
}

// Import users from xlsx:
// - Postman form-data:
//   - to: email nhận report
//   - file: .xlsx (header row 1: username,email)
router.post("/import", uploadExcel.single("file"), async function (req, res, next) {
  const reportTo = String(req.body.to || '').trim()
  if (!reportTo) {
    res.status(400).send({ message: "Missing field: to" })
    return;
  }
  if (!req.file) {
    res.status(400).send({ message: "Missing file" })
    return;
  }

  const xlsxPath = req.file.path
  const originalName = req.file.originalname

  let roleUser = await roleModel.findOne({
    isDeleted: false,
    name: new RegExp('^user$', 'i')
  })
  // fallback theo ID đang dùng ở routes/auth.js
  const fallbackRoleUserId = '69b6231b3de61addb401ea26'
  const roleUserId = roleUser ? roleUser._id : fallbackRoleUserId

  let parsedRows = []
  try {
    parsedRows = await parseUsersXlsx(xlsxPath)
  } catch (e) {
    try { fs.unlinkSync(xlsxPath) } catch (err) { }
    res.status(400).send({ message: e.message })
    return;
  }

  const result = []
  let success = 0, skipped = 0, failed = 0

  for (const item of parsedRows) {
    const { username, email, row } = item
    try {
      const exists = await userModel.findOne({
        isDeleted: false,
        $or: [{ username }, { email }]
      })
      if (exists) {
        skipped++
        result.push({ row, success: false, message: "duplicate username/email" })
        continue
      }

      const password = randomPassword16()
      await userController.CreateAnUser(username, password, email, roleUserId)
      await sendPasswordMail(email, username, password)

      success++
      result.push({ row, success: true, username, email })
    } catch (e) {
      failed++
      result.push({ row, success: false, message: e.message })
    }
  }

  const summary = JSON.stringify({ success, skipped, failed }, null, 2)
  try {
    await sendImportReportMail(reportTo, originalName, xlsxPath, summary)
  } catch (e) {
    // vẫn trả kết quả import; báo thêm lỗi gửi report
    result.push({ row: 0, success: false, message: "send report failed: " + e.message })
  }

  try { fs.unlinkSync(xlsxPath) } catch (err) { }
  res.send({ summary: { success, skipped, failed }, result })
});


router.get("/", CheckLogin, checkRole("ADMIN","MODERATOR"), async function (req, res, next) {//ADMIN
  let users = await userController.GetAllUser()
  res.send(users);
});

router.get("/:id", async function (req, res, next) {
  let result = await userController.GetUserById(
    req.params.id
  )
  if (result) {
    res.send(result);
  } else {
    res.status(404).send({ message: "id not found" })
  }
});

router.post("/", CreateAnUserValidator, validatedResult, async function (req, res, next) {
  
  try {
    let user = await userController.CreateAnUser(
      req.body.username, req.body.password,
      req.body.email, req.body.role
    )
    res.send(user);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put("/:id", ModifyAnUserValidator, validatedResult, async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate
      (id, req.body, { new: true });

    if (!updatedItem) return res.status(404).send({ message: "id not found" });

    let populated = await userModel
      .findById(updatedItem._id)
    res.send(populated);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }
    res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;