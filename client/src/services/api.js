import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
  timeout: 60000,
});

export async function getDefaultModel() {
  return (await api.get("/model/default")).data;
}

export async function calculateModel(model) {
  return (await api.post("/model/calculate", model)).data;
}

export async function saveRun(input, result) {
  return (await api.post("/model/runs", { input, result })).data;
}

export async function listRuns() {
  return (await api.get("/model/runs")).data;
}

export async function uploadWorkbook(file) {
  const form = new FormData();
  form.append("file", file);
  return (
    await api.post("/import/excel", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  ).data;
}

export async function getDiseases() {
  return (await api.get("/reference/diseases")).data;
}

export async function getSubgroups(diseaseCode) {
  return (await api.get(`/reference/subgroups/${diseaseCode}`)).data;
}

export async function getRefreshLog() {
  return (await api.get("/reference/refresh-log")).data;
}

export async function getTrials(diseaseCode) {
  return (
    await api.get("/reference/trials", { params: { diseaseCode } })
  ).data;
}

export async function syncWorldBank(payload) {
  return (await api.post("/public/sync/world-bank", payload)).data;
}

export async function syncClinicalTrials(payload) {
  return (await api.post("/public/sync/clinical-trials", payload)).data;
}

export async function getOpenFdaLabels(search) {
  return (
    await api.get("/public/openfda/labels", {
      params: { search, limit: 10 },
    })
  ).data;
}
