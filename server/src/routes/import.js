import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  parseBiaWorkbook,
  persistImportedModel,
} from "../services/excelImporter.js";

const uploadDir = path.resolve("uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const importRouter = express.Router();

importRouter.post("/excel", upload.single("file"), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: "Excel file required." });

  try {
    const model = parseBiaWorkbook(req.file.path);
    const importJob = await persistImportedModel(
      model,
      req.file.originalname
    );

    res.json({ importJob, model });
  } catch (error) {
    next(error);
  } finally {
    if (req.file?.path) {
      fs.promises.unlink(req.file.path).catch(() => {});
    }
  }
});
