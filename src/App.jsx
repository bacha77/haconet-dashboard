import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Send, User, CheckCircle, Clock, Volume2, Megaphone, Info, Users, Download, ArrowLeft, Paperclip } from 'lucide-react';
import './App.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [currentView, setCurrentView] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState({});
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [filter, setFilter] = useState('unread');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  
  // CRM Profile State
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', email: '', notes: '', address: '' });
  
  // Translation State
  const [translations, setTranslations] = useState({});
  const [translatingId, setTranslatingId] = useState(null);
  const [isTranslatingDraft, setIsTranslatingDraft] = useState(false);

  const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }
    
    // Fetch initial data
    const fetchData = async () => {
      const { data: msgs } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
      const { data: cnts } = await supabase.from('contacts').select('*');
      
      if (msgs) setMessages(msgs);
      if (cnts) {
        const cntsMap = {};
        cnts.forEach(c => cntsMap[c.phone_number] = c);
        setContacts(cntsMap);
      }
    };
    fetchData();

    // Listen for new messages
    const msgSub = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        setMessages(current => [...current, payload.new]);
        
        // Notification Logic
        if (payload.new.direction === 'inbound') {
          audioRef.current.play().catch(e => console.log('Audio play failed:', e));
          if (Notification.permission === "granted") {
            new Notification("New Message from " + payload.new.sender_number, {
              body: payload.new.body || "Media message received",
              icon: "/vite.svg"
            });
          }
        }
      })
      .subscribe();

    const contactSub = supabase
      .channel('public:contacts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, payload => {
        setContacts(current => ({ ...current, [payload.new.phone_number]: payload.new }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgSub);
      supabase.removeChannel(contactSub);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedNumber]);
  
  // Load profile when selected number changes
  useEffect(() => {
    if (selectedNumber && contacts[selectedNumber]) {
      const c = contacts[selectedNumber];
      setProfileForm({
        first_name: c.first_name || '',
        last_name: c.last_name || '',
        email: c.email || '',
        notes: c.notes || '',
        address: c.address || ''
      });
    }
  }, [selectedNumber, contacts]);

  // Update browser tab with unread count
  useEffect(() => {
    const unreadCount = Object.values(contacts).filter(c => c.status === 'unread').length;
    document.title = unreadCount > 0 ? `(${unreadCount}) Haconet Inbox` : 'Haconet Inbox';
  }, [contacts]);

  const uniqueNumbers = [...new Set(messages.map(m => m.sender_number))];

  const filteredNumbers = uniqueNumbers.filter(num => {
    const status = contacts[num]?.status || 'unread';
    const dept = contacts[num]?.department || 'General';
    
    // Status filter
    const statusMatch = filter === 'all' ? true : status === filter;
    
    // Department filter
    const deptMatch = departmentFilter === 'All' ? true : dept === departmentFilter;
    
    // Search filter
    const searchMatch = num.includes(searchTerm);
    
    return statusMatch && deptMatch && searchMatch;
  });

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!replyText.trim() && !selectedFile) || !selectedNumber) return;
    setIsSending(true);
    try {
      const formData = new FormData();
      formData.append('to', selectedNumber);
      if (replyText.trim()) formData.append('body', replyText);
      if (selectedFile) formData.append('file', selectedFile);

      await fetch('https://haconet-twilio-phone.onrender.com/api/reply', {
        method: 'POST',
        body: formData
      });
      setReplyText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Send error:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    setIsBroadcasting(true);
    try {
      await fetch('http://localhost:3000/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastText })
      });
      setBroadcastText('');
      setShowBroadcast(false);
      alert('Broadcast sent successfully!');
    } catch (error) {
      console.error('Broadcast error:', error);
      alert('Failed to send broadcast');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleResolve = async (number) => {
    try {
      await fetch('http://localhost:3000/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: number })
      });
    } catch (error) {
      console.error('Resolve error:', error);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!selectedNumber) return;
    setIsSavingProfile(true);
    try {
      await fetch('http://localhost:3000/api/update-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: selectedNumber, ...profileForm })
      });
      // Optimistic update
      setContacts(curr => ({
        ...curr,
        [selectedNumber]: { ...curr[selectedNumber], ...profileForm }
      }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Save profile error:', error);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleTranslate = async (msgId, text) => {
    if (!text) return;
    setTranslatingId(msgId);
    try {
      const res = await fetch('http://localhost:3000/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      setTranslations(prev => ({ ...prev, [msgId]: data.translation }));
    } catch (error) {
      console.error('Translate error:', error);
    } finally {
      setTranslatingId(null);
    }
  };

  const handleTranslateDraft = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setIsTranslatingDraft(true);
    try {
      const res = await fetch('http://localhost:3000/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText, target: 'creole' })
      });
      const data = await res.json();
      setReplyText(data.translation);
    } catch (error) {
      console.error('Translate Draft Error:', error);
    } finally {
      setIsTranslatingDraft(false);
    }
  };

  const chatMessages = messages.filter(m => m.sender_number === selectedNumber);

  const departments = ['All', 'Immigration', 'ESL', 'Health', 'Cultural', 'General'];
  
  const quickReplies = [
    "Biwo nou louvri lendi rive vandredi, soti 9è nan maten pou rive 5è nan aswè. (Office hours)",
    "Adrès nou se 2020 Brice Rd, Reynoldsburg, OH 43068. (Address)",
    "Èske ou ka ban nou non konplè w ak dat nesans ou tanpri? (Ask for Name/DOB)",
    "Tanpri, èske w ka voye yon mesaj vwa pou eksplike ka w la pi byen? (Ask for Voice Note)",
    "Youn nan ajan imigrasyon nou yo ap kontakte w byento. (Immigration Follow-up)",
    "Kilè ou ta renmen pran yon randevou pou klas angle a? (ESL Appointment)",
    "Pou kesyon sante a, èske ou gen asirans medikal? (Health Insurance Ask)",
    "Mèsi paske w kontakte Haconet! Kijan nou ka ede w jodi a? (Greeting)"
  ];

  const exportToCSV = () => {
    const headers = ['Phone Number', 'First Name', 'Last Name', 'Email', 'Address', 'Department', 'Notes'];
    const rows = Object.values(contacts).map(c => [
      c.phone_number || '',
      c.first_name || '',
      c.last_name || '',
      c.email || '',
      c.address || '',
      c.department || '',
      (c.notes || '').replace(/\n/g, ' ')
    ]);
    
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += headers.join(',') + '\r\n';
    rows.forEach(row => {
      const escapedRow = row.map(cell => `"${cell.replace(/"/g, '""')}"`);
      csvContent += escapedRow.join(',') + '\r\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `haconet_contacts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="dashboard-layout">
      
      {/* TOP HORIZONTAL NAV */}
      <header className="top-nav">
        <div className="nav-brand">
          <img src={`${import.meta.env.BASE_URL}logo.jpg.jpg`} alt="Haconet Logo" className="brand-logo" />
          <span>Haconet Inbox</span>
        </div>
        
        <div className="nav-tabs">
          {departments.map(dept => (
            <button 
              key={dept} 
              className={`tab-btn ${departmentFilter === dept ? 'active' : ''}`}
              onClick={() => {
                setDepartmentFilter(dept);
                setSelectedNumber(null); // Clear selection on dept switch
              }}
            >
              {dept}
            </button>
          ))}
        </div>
        
        <div className="nav-actions">
          {currentView === 'inbox' ? (
            <button className="btn-secondary" onClick={() => setCurrentView('directory')}>
              <Users size={16} /> Contacts Directory
            </button>
          ) : (
            <button className="btn-secondary" onClick={() => setCurrentView('inbox')}>
              <ArrowLeft size={16} /> Back to Inbox
            </button>
          )}
          <button className="btn-broadcast-header" onClick={() => setShowBroadcast(true)}>
            <Megaphone size={16} /> Broadcast
          </button>
        </div>
      </header>

      {/* MAIN CONTENT SPLIT */}
      <div className="main-content">
        
        {/* INNER SIDEBAR (CONTACTS) */}
        <div className="inbox-sidebar">
          <div className="inbox-header">
            <input 
              type="text" 
              className="search-input-glass" 
              placeholder="Search phone number..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <div className="pill-tabs" style={{ marginTop: '12px' }}>
              <button className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>Unread</button>
              <button className={filter === 'resolved' ? 'active' : ''} onClick={() => setFilter('resolved')}>Resolved</button>
              <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All Status</button>
            </div>
          </div>

          <div className="contact-list">
            {filteredNumbers.map(number => (
              <div 
                key={number} 
                className={`contact-item ${selectedNumber === number ? 'active' : ''}`}
                onClick={() => setSelectedNumber(number)}
              >
                <div className="avatar-glass">
                  <User size={20} />
                </div>
                <div className="contact-info">
                  <div className="contact-number">
                    {contacts[number]?.first_name ? `${contacts[number].first_name} ${contacts[number].last_name || ''}` : number}
                    {departmentFilter === 'All' && contacts[number] && contacts[number].department && (
                      <span className="mini-badge">{contacts[number].department}</span>
                    )}
                    {contacts[number] && !contacts[number].bot_active && (
                      <span className="paused-dot" title="Bot Paused"></span>
                    )}
                  </div>
                  <div className="contact-preview">
                    {contacts[number]?.first_name && <span style={{fontSize: '10px', opacity: 0.6, display: 'block'}}>{number}</span>}
                    {messages.filter(m => m.sender_number === number).slice(-1)[0]?.body || 'Media attached'}
                  </div>
                </div>
              </div>
            ))}
            {filteredNumbers.length === 0 && (
              <div className="empty-state-small">
                <Info size={24} style={{marginBottom: 8, opacity: 0.5}} />
                <p>No conversations found.</p>
              </div>
            )}
          </div>
        </div>

        {/* CHAT AREA */}
        <div className="chat-area">
          {selectedNumber ? (
            <>
              <div className="chat-header">
                <div className="chat-header-info">
                  <div className="avatar-glass"><User size={24} /></div>
                  <h3>
                    {contacts[selectedNumber]?.first_name 
                      ? `${contacts[selectedNumber].first_name} ${contacts[selectedNumber].last_name || ''}` 
                      : selectedNumber}
                  </h3>
                  {contacts[selectedNumber] && contacts[selectedNumber].department && (
                    <span className="dept-badge-glass">{contacts[selectedNumber].department}</span>
                  )}
                  {contacts[selectedNumber] && !contacts[selectedNumber].bot_active && (
                    <span className="dept-badge-glass warning">🤖 Bot Paused</span>
                  )}
                </div>
                <div className="chat-header-actions">
                  <button className="btn-resolve-glass" onClick={() => handleResolve(selectedNumber)}>
                    <CheckCircle size={16} /> Mark Resolved
                  </button>
                </div>
              </div>
              
              <div className="messages-container">
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`message-wrapper ${msg.direction}`}>
                    <div className={`message-bubble ${msg.direction}`}>
                      {msg.body && <p>{msg.body}</p>}
                      {msg.media_url && msg.media_type && msg.media_type.startsWith('audio/') && (
                        <audio controls src={`https://haconet-twilio-phone.onrender.com/api/media?url=${encodeURIComponent(msg.media_url)}`} className="audio-player" />
                      )}
                      {msg.media_url && msg.media_type && msg.media_type.startsWith('image/') && (
                        <img src={`https://haconet-twilio-phone.onrender.com/api/media?url=${encodeURIComponent(msg.media_url)}`} alt="attachment" className="image-attachment" />
                      )}
                      {msg.media_url && msg.media_type && !msg.media_type.startsWith('audio/') && !msg.media_type.startsWith('image/') && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', marginTop: '8px' }}>
                          <Paperclip size={20} />
                          <span>Document Attached</span>
                        </div>
                      )}
                      {msg.media_url && !msg.media_type && (
                        <img src={msg.media_url} alt="outbound attachment" className="image-attachment" style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '8px' }} />
                      )}

                      {msg.media_url && (
                        <div style={{ marginTop: '4px' }}>
                          <a 
                            href={msg.direction === 'inbound' ? `https://haconet-twilio-phone.onrender.com/api/media?url=${encodeURIComponent(msg.media_url)}` : msg.media_url}
                            target="_blank" 
                            rel="noopener noreferrer" 
                            download 
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none' }}
                          >
                            <Download size={14} /> Download File
                          </a>
                        </div>
                      )}
                      
                      {translations[msg.id] && (
                        <div className="translation-box">
                          <strong>English:</strong> {translations[msg.id]}
                        </div>
                      )}
                      
                      <div className="message-footer">
                        {msg.direction === 'inbound' && msg.body && (
                          <button 
                            className="btn-translate-glass" 
                            onClick={() => handleTranslate(msg.id, msg.body)}
                            disabled={translatingId === msg.id || translations[msg.id]}
                          >
                            {translatingId === msg.id ? 'Translating...' : 'A/文 Translate'}
                          </button>
                        )}
                        <span className="timestamp">
                          <Clock size={10} style={{ marginRight: '4px' }}/>
                          {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              
              <div className="chat-input-container">
                <div className="quick-replies">
                  {(() => {
                    const dept = (contacts[selectedNumber]?.department || 'General').toLowerCase();
                    let replies = [];
                    if (dept.includes('immigration')) {
                      replies = [
                        "Our address is 2020 Brice Rd, Reynoldsburg, OH 43068.",
                        "What is your Alien Registration Number (A-Number)?",
                        "Are you inquiring about TPS, Asylum, or a Work Permit?",
                        "Please bring your passport and any immigration documents to your appointment.",
                        "Do you have an upcoming immigration court date?",
                        "We provide assistance with filling out the I-589 asylum application.",
                        "What country did you immigrate from?",
                        "We have lawyers available for consultation next week."
                      ];
                    } else if (dept.includes('esl')) {
                      replies = [
                        "Our address is 2020 Brice Rd, Reynoldsburg, OH 43068.",
                        "What is your current English speaking level (Beginner/Intermediate/Advanced)?",
                        "Our ESL classes are held on Tuesday and Thursday evenings.",
                        "Would you like to register for the next ESL session?",
                        "Do you need childcare during ESL classes?",
                        "Have you taken an ESL assessment test with us before?",
                        "Our English classes are entirely free of charge."
                      ];
                    } else if (dept.includes('health')) {
                      replies = [
                        "Our address is 2020 Brice Rd, Reynoldsburg, OH 43068.",
                        "Do you have any current medical insurance (Medicaid/Medicare)?",
                        "We can help you schedule an appointment with a local clinic.",
                        "Is this a medical emergency? If yes, please call 911.",
                        "Are you experiencing any specific symptoms right now?",
                        "We can assist with Medicaid and food stamp applications.",
                        "Do you need a list of free medical clinics in the Columbus area?"
                      ];
                    } else if (dept.includes('cultural')) {
                      replies = [
                        "Our address is 2020 Brice Rd, Reynoldsburg, OH 43068.",
                        "Are you interested in our upcoming community events?",
                        "We offer cultural orientation sessions every month.",
                        "Would you like to volunteer with Haconet?",
                        "Would you like to join our community WhatsApp group?",
                        "We offer job placement and resume building workshops."
                      ];
                    } else {
                      // General / Other
                      replies = [
                        "Our address is 2020 Brice Rd, Reynoldsburg, OH 43068.",
                        "How can Haconet assist you today?",
                        "Our office hours are Monday to Friday, 9am to 5pm.",
                        "Could you please provide your full name?",
                        "Could you please provide your email address?",
                        "A staff member is reviewing your message and will be with you shortly."
                      ];
                    }
                    return replies.map((text, idx) => (
                      <button key={idx} className="quick-reply-btn" onClick={() => setReplyText(text)}>
                        {text}
                      </button>
                    ));
                  })()}
                </div>
                <form className="chat-input-glass" onSubmit={handleSend}>
                  <input 
                    type="file" 
                    style={{ display: 'none' }} 
                    ref={fileInputRef} 
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                  />
                  <button 
                    type="button" 
                    className="btn-translate-outbound" 
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach File"
                    style={{ padding: '8px' }}
                  >
                    <Paperclip size={18} />
                  </button>
                  <button 
                    type="button" 
                    className="btn-translate-outbound" 
                    onClick={handleTranslateDraft}
                    disabled={isTranslatingDraft || !replyText.trim()}
                    title="Translate to Haitian Creole"
                  >
                    {isTranslatingDraft ? '...' : '文 Creole'}
                  </button>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: '12px' }}>
                    {selectedFile && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '4px' }}>
                        📎 {selectedFile.name} 
                        <span style={{ cursor: 'pointer', marginLeft: '8px', opacity: 0.7 }} onClick={() => { setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}>✖</span>
                      </div>
                    )}
                    <input 
                      type="text" 
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type a message (or type in English and translate)..." 
                      disabled={isSending}
                      style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent' }}
                    />
                  </div>
                  <button type="submit" disabled={isSending || (!replyText.trim() && !selectedFile)} className="send-btn-glass">
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </>
          ) : (
          <div className="empty-state-glass">
              <Volume2 size={48} className="empty-icon" />
              <h2>Welcome to Haconet Inbox</h2>
              <p>Select a conversation from the sidebar to begin.</p>
            </div>
          )}
        </div>

        {/* CRM SIDEBAR */}
        {selectedNumber && currentView === 'inbox' && (
          <div className="crm-sidebar">
            <div className="crm-header">
              <h3>Contact Info</h3>
            </div>
            <form className="crm-form" onSubmit={handleSaveProfile}>
              <div className="form-group">
                <label>First Name</label>
                <input 
                  type="text" 
                  value={profileForm.first_name} 
                  onChange={e => setProfileForm({...profileForm, first_name: e.target.value})}
                  placeholder="First Name"
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input 
                  type="text" 
                  value={profileForm.last_name} 
                  onChange={e => setProfileForm({...profileForm, last_name: e.target.value})}
                  placeholder="Last Name"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input 
                  type="email" 
                  value={profileForm.email} 
                  onChange={e => setProfileForm({...profileForm, email: e.target.value})}
                  placeholder="Email Address"
                />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input 
                  type="text" 
                  value={profileForm.address} 
                  onChange={e => setProfileForm({...profileForm, address: e.target.value})}
                  placeholder="Home or Mailing Address"
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea 
                  value={profileForm.notes} 
                  onChange={e => setProfileForm({...profileForm, notes: e.target.value})}
                  placeholder="Additional context..."
                  rows="5"
                />
              </div>
              <button 
                type="submit" 
                className="btn-save-crm" 
                disabled={isSavingProfile}
                style={{ backgroundColor: saveSuccess ? '#10b981' : '' }}
              >
                {isSavingProfile ? 'Saving...' : saveSuccess ? '✓ Saved!' : 'Save Profile'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* CONTACTS DIRECTORY OVERLAY */}
      {currentView === 'directory' && (
        <div className="directory-overlay">
          <div className="directory-header">
            <h2>Contacts Directory</h2>
            <button className="btn-export" onClick={exportToCSV}>
              <Download size={18} /> Export to Excel (CSV)
            </button>
          </div>
          <div className="directory-table-container">
            <table className="directory-table">
              <thead>
                <tr>
                  <th>Phone Number</th>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th>Department</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(contacts).map(contact => (
                  <tr key={contact.phone_number}>
                    <td>{contact.phone_number}</td>
                    <td>{contact.first_name || '-'}</td>
                    <td>{contact.last_name || '-'}</td>
                    <td>{contact.email || '-'}</td>
                    <td>{contact.address || '-'}</td>
                    <td>{contact.department || '-'}</td>
                  </tr>
                ))}
                {Object.values(contacts).length === 0 && (
                  <tr>
                    <td colSpan="6" style={{textAlign: 'center', padding: '32px', color: 'var(--text-muted)'}}>
                      No contacts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BROADCAST MODAL (GLASS) */}
      {showBroadcast && (
        <div className="modal-overlay">
          <div className="modal-content-glass">
            <h2><Megaphone size={20} /> Broadcast Message</h2>
            <p>Send a message to EVERY contact in the database.</p>
            <form onSubmit={handleBroadcast}>
              <textarea 
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Type your announcement here..."
                rows="4"
              />
              <div className="modal-actions">
                <button type="button" className="btn-cancel-glass" onClick={() => setShowBroadcast(false)}>Cancel</button>
                <button type="submit" className="btn-send-glass" disabled={isBroadcasting || !broadcastText.trim()}>
                  {isBroadcasting ? 'Sending...' : 'Send Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
