import { useEffect, useState } from 'react';
import { getAccessToken } from '../../auth/authStorage';
import { resolveMediaUrl } from '../../utils/media';

const AuthenticatedMediaImage = ({ src, alt, className = '' }) => {
  const [objectUrl, setObjectUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src) {
      setObjectUrl('');
      setFailed(true);
      return undefined;
    }

    let active = true;
    let localUrl = '';
    setFailed(false);
    setObjectUrl('');

    const loadImage = async () => {
      try {
        const token = getAccessToken();
        const response = await fetch(resolveMediaUrl(src), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error(`Media request failed: ${response.status}`);
        const blob = await response.blob();
        localUrl = URL.createObjectURL(blob);
        if (active) setObjectUrl(localUrl);
      } catch (err) {
        if (active) setFailed(true);
      }
    };

    loadImage();

    return () => {
      active = false;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [src]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-navy-900 text-xs text-slate-500 ${className}`}>
        Image unavailable
      </div>
    );
  }

  if (!objectUrl) {
    return <div className={`animate-pulse bg-navy-800 ${className}`} aria-label="Loading evidence image" />;
  }

  return <img src={objectUrl} alt={alt} className={className} />;
};

export default AuthenticatedMediaImage;
