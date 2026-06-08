import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = `${import.meta.env.BASE_URL}login`;
    }
    return Promise.reject(err);
  }
);

export default api;
