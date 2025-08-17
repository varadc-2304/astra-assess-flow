export const getBrowserInfo = () => {
  const userAgent = navigator.userAgent;
  
  // Browser detection
  const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor);
  const isSafari = /Safari/.test(userAgent) && /Apple Computer/.test(navigator.vendor);
  const isFirefox = /Firefox/.test(userAgent);
  const isEdge = /Edg/.test(userAgent);
  const isOpera = /OPR/.test(userAgent);
  
  // Mobile detection
  const isMobile = /Mobi|Android/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  
  // Get browser name
  let browserName = 'Unknown';
  if (isChrome) browserName = 'Chrome';
  else if (isSafari) browserName = 'Safari';
  else if (isFirefox) browserName = 'Firefox';
  else if (isEdge) browserName = 'Edge';
  else if (isOpera) browserName = 'Opera';
  
  return {
    isChrome,
    isSafari,
    isFirefox,
    isEdge,
    isOpera,
    isMobile,
    isIOS,
    isAndroid,
    browserName,
    userAgent
  };
};

export const isBrowserAllowed = () => {
  const { isChrome } = getBrowserInfo();
  return isChrome;
};

export const getBrowserRestrictionMessage = () => {
  const { browserName, isMobile } = getBrowserInfo();
  
  if (isMobile) {
    return `You are using ${browserName} on mobile. Please use Google Chrome browser to take this assessment for proper anti-cheating measures.`;
  }
  
  return `You are using ${browserName}. Please use Google Chrome browser to take this assessment for proper anti-cheating measures.`;
};