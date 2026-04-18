import React, { useState, useEffect } from 'react';
import { ShoppingCart, X, HelpCircle } from 'lucide-react';
import api from '../utils/api';

export default function ServicesPortal() {
  const [services, setServices] = useState([]);
  const [settings, setSettings] = useState({});
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [selectedServiceToBuy, setSelectedServiceToBuy] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [servRes, setRes] = await Promise.all([
            api.get('/services'),
            api.get('/settings')
        ]);
        setServices(servRes.data);
        setSettings(setRes.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  const openBuyModal = (service) => {
    setSelectedServiceToBuy(service);
    setIsBuyModalOpen(true);
  };

  return (
    <div className="fade-in">
      <div className="glass-panel" style={{ marginBottom: '2rem' }}>
        <h3>Dịch Vụ Khác</h3>
        <p style={{ color: '#aaa', fontSize: '0.95rem', marginTop: '0.5rem' }}>
          Danh sách các dịch vụ kèm theo (Nạp game, Cày thuê, Nâng cấp...). Bấm Mua để giao dịch trực tiếp với Admin.
        </p>
      </div>

      <div className="grid">
        {services.map(svc => (
          <div key={svc.id} className="glass-panel fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0', overflow: 'hidden' }}>
            
            {svc.image_url ? (
               <img src={svc.image_url} alt={svc.name} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
            ) : (
               <div style={{ width: '100%', height: '180px', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <HelpCircle size={48} color="rgba(255,255,255,0.2)" />
               </div>
            )}
            
            <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <h3 style={{ marginBottom: '0.5rem' }}>{svc.name}</h3>
                
                {svc.description && <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '1rem', flex: 1 }}>{svc.description}</p>}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                    <div>
                        <div style={{ color: 'var(--steam-blue)', fontWeight: 'bold', fontSize: '1.2rem' }}>{svc.price || 'Liên hệ'}</div>
                    </div>
                    
                    <button onClick={() => openBuyModal(svc)} className="btn btn-primary" style={{ borderRadius: '2px' }}>
                        <ShoppingCart size={16} /> Mua Dịch Vụ
                    </button>
                </div>
            </div>
          </div>
        ))}
        {services.length === 0 && (
           <p style={{ color: '#aaa' }}>Hiện tại chưa có dịch vụ nào.</p>
        )}
      </div>

      {isBuyModalOpen && (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.8)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div className="glass-panel fade-in" style={{ width: '90%', maxWidth: '500px', background: 'var(--steam-bg-darker)', position: 'relative' }}>
                <button onClick={() => setIsBuyModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                    <X size={24} />
                </button>
                <h2 style={{ marginBottom: '1rem' }}>Mua Dịch Vụ: <span style={{color: 'var(--steam-blue)'}}>{selectedServiceToBuy?.name}</span></h2>
                <p style={{ color: '#ccc', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                    Bạn đang yêu cầu giao dịch dịch vụ trên. Vui lòng nhắn tin trực tiếp cho Admin qua Box chat dưới đây để thoả thuận và thanh toán:
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(settings.zalo && settings.zalo !== '') ? (
                        <a href={settings.zalo.startsWith('http') ? settings.zalo : `https://zalo.me/${settings.zalo}`} target="_blank" rel="noreferrer" className="btn btn-success" style={{ justifyContent: 'center', padding: '1rem', fontSize: '1.1rem' }}>
                           Liên hệ qua Zalo ({settings.zalo})
                        </a>
                    ) : null}

                    {(settings.facebook && settings.facebook !== '') ? (
                        <a href={settings.facebook} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ justifyContent: 'center', padding: '1rem', fontSize: '1.1rem' }}>
                           Liên hệ qua Facebook
                        </a>
                    ) : null}

                    {(!settings.zalo && !settings.facebook) && (
                        <p style={{color: 'red', textAlign: 'center'}}>Admin chưa cập nhật thông tin liên hệ.</p>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
