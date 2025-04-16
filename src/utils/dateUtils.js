/**
 * Format a date string into a readable format
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date
 */
export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return dateString; // Retornar a string original se não for uma data válida
  }
  
  // Formatar como: DD/MM/YYYY HH:MM
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

/**
 * Get start of the current day
 * @param {Date} date - Date object
 * @returns {Date} - Start of the day
 */
export const getStartOfDay = (date = new Date()) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay;
};

/**
 * Get start of the current month
 * @param {Date} date - Date object
 * @returns {Date} - Start of the month
 */
export const getStartOfMonth = (date = new Date()) => {
  const startOfMonth = new Date(date);
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  return startOfMonth;
};

/**
 * Get start of the current year
 * @param {Date} date - Date object
 * @returns {Date} - Start of the year
 */
export const getStartOfYear = (date = new Date()) => {
  const startOfYear = new Date(date);
  startOfYear.setMonth(0, 1);
  startOfYear.setHours(0, 0, 0, 0);
  return startOfYear;
};

/**
 * Format a timestamp to show how long ago it was
 * @param {string} timestamp - ISO date string
 * @returns {string} - Time ago text
 */
export const getTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  
  if (isNaN(date.getTime())) {
    return timestamp; // Retornar a string original se não for uma data válida
  }
  
  const now = new Date();
  const diffSeconds = Math.floor((now - date) / 1000);
  
  if (diffSeconds < 60) {
    return 'Agora mesmo';
  }
  
  const diffMinutes = Math.floor(diffSeconds / 60);
  
  if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'} atrás`;
  }
  
  const diffHours = Math.floor(diffMinutes / 60);
  
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hora' : 'horas'} atrás`;
  }
  
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays < 30) {
    return `${diffDays} ${diffDays === 1 ? 'dia' : 'dias'} atrás`;
  }
  
  const diffMonths = Math.floor(diffDays / 30);
  
  if (diffMonths < 12) {
    return `${diffMonths} ${diffMonths === 1 ? 'mês' : 'meses'} atrás`;
  }
  
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} ${diffYears === 1 ? 'ano' : 'anos'} atrás`;
};