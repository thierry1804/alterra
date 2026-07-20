import axios from "axios";
import { db } from "../db/db";

export const api = axios.create({ baseURL: "/api/v1", withCredentials: true });

api.interceptors.request.use(async (config) => {
  const token = await db.meta.get("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token.value}`;
  return config;
});
