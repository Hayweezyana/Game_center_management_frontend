import axios from 'axios';

const instance = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL,
});

// Request interceptor to attach access token
instance.interceptors.request.use(config => {
  const token = localStorage.getItem("operatorToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle token expiry and refresh
instance.interceptors.response.use(
  res => res,
  async err => {
    const originalRequest = err.config;

    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem("refreshToken");

      try {
        const { data } = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/operators/refresh-token`, {
          refreshToken,
        });

        localStorage.setItem("operatorToken", data.token); // new access token

        originalRequest.headers.Authorization = `Bearer ${data.token}`;
        return instance(originalRequest); // Retry original request
      } catch (refreshError) {
        console.error("Session expired. Please login again.");
        localStorage.clear();
        window.location.href = "/operator-login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(err);
  }
);

export default instance;
