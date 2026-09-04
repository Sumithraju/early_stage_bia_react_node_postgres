import express from "express";
import multer from "multer";
import os from "os";
import path from "path";
import fs from "fs";
import {
  parseBiaWorkbook,
  persistImportedModel,
} from "../services/excelImporter.js";
import { validateModel } from "../../../shared/modelValidation.js";

// Render's disk is ephemeral and the working directory is not guaranteed to be
// writable, so uploads land in the OS temp dir unless UPLOAD_DIR overrides it.
// Each file is unlinked in the `finally` block below once it has been parsed.
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(os.tmpdir(), "bia-uploads");

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

    // An uploaded workbook is the least trustworthy input the app takes, so it
    // is checked against the same rules as anything typed into the UI.
    const v = validateModel(model);
    if (!v.ok) {
      return res.status(400).json({
        error: "The uploaded workbook does not describe a valid model.",
        errors: v.errors,
        warnings: v.warnings,
      });
    }

    const importJob = await persistImportedModel(
      model,
      req.file.originalname
    );

    res.json({ importJob, model, warnings: v.warnings });
  } catch (error) {
    next(error);
  } finally {
    if (req.file?.path) {
      fs.promises.unlink(req.file.path).catch(() => {});
    }
  }
});
