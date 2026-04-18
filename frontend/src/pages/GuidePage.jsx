import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function GuidePage() {
  const [guideHtml, setGuideHtml] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        if (res.data.guide_html) {
           setGuideHtml(res.data.guide_html);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchSettings();
  }, []);

  return (
    <div className="fade-in">
        <div className="glass-panel" style={{ minHeight: '60vh', padding: '2rem' }}>
            <div dangerouslySetInnerHTML={{ __html: guideHtml }} />
        </div>
    </div>
  );
}
