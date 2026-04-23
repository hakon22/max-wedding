import axios from 'axios';

/**
 * HTTP-клиент для запросов к API приложения (тот же origin)
 */
export const apiClient = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});
