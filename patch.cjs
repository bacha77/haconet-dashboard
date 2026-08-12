const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'App.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. State replacements
content = content.replace(
  "const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('haconet_auth') === 'true');\n  const [loginPassword, setLoginPassword] = useState('');\n  const [loginError, setLoginError] = useState(false);",
  `const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userStaffName, setUserStaffName] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState(false);`
);

// 2. Add auth listener in useEffect
const useEffectStart = `  useEffect(() => {
    if (Notification.permission !== "granted") {`;
    
const newUseEffectStart = `  useEffect(() => {
    // Auth Listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setAuthLoading(false);
    });

    if (Notification.permission !== "granted") {`;

content = content.replace(useEffectStart, newUseEffectStart);

const returnUnsub = `    return () => {
      supabase.removeChannel(msgSub);
      supabase.removeChannel(contactSub);
    };`;
const newReturnUnsub = `    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(msgSub);
      supabase.removeChannel(contactSub);
    };`;
content = content.replace(returnUnsub, newReturnUnsub);

// 3. Add useEffect for role fetching
const newUseEffectRoles = `
  // Fetch Role when session changes
  useEffect(() => {
    const fetchRole = async () => {
      if (!session?.user?.email) return;
      try {
        const { data: staffData, error } = await supabase.from('staff').select('*').eq('email', session.user.email).single();
        if (staffData) {
          setUserRole(staffData.role || 'tenant');
          setUserStaffName(staffData.name);
          if (staffData.role !== 'admin') {
            setStaffFilter(staffData.name);
          }
        } else {
          // If staff doesn't exist, assume they are a new tenant
          setUserRole('tenant');
          // Optional: Insert them into staff table here, but let's just let them view nothing until an admin sets them up
          setUserStaffName(''); 
        }
      } catch (err) {
        console.error("Error fetching role:", err);
      } finally {
        setAuthLoading(false);
      }
    };
    if (session) {
      fetchRole();
    }
  }, [session]);
`;

content = content.replace(`  // Load profile when selected number changes`, newUseEffectRoles + `\n  // Load profile when selected number changes`);

// 4. Update handleLogout
content = content.replace(
  `  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('haconet_auth');
  };`,
  `  const handleLogout = async () => {
    await supabase.auth.signOut();
  };`
);

// 5. Update login UI
const loginUiStart = `  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-box">
          <img src={\`\${import.meta.env.BASE_URL}logo.jpg.jpg\`} alt="Haconet Logo" className="login-logo" />
          <h2>Staff Login</h2>
          <p>Please enter the dashboard password to continue.</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (loginPassword === 'Haconet@2026') {
              setIsAuthenticated(true);
              sessionStorage.setItem('haconet_auth', 'true');
              setLoginError(false);
            } else {
              setLoginError(true);
            }
          }}>
            <input 
              type="password" 
              placeholder="Password" 
              value={loginPassword} 
              onChange={e => setLoginPassword(e.target.value)} 
              autoFocus
              className="login-input"
            />
            {loginError && <p className="login-error">Incorrect password.</p>}
            <button type="submit" className="login-btn">Login</button>
          </form>
        </div>
      </div>
    );
  }`;

const newLoginUi = `  if (authLoading) {
    return <div style={{display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: 'white'}}>Loading...</div>;
  }

  if (!session) {
    return (
      <div className="login-container">
        <div className="login-box">
          <img src={\`\${import.meta.env.BASE_URL}logo.jpg.jpg\`} alt="Haconet Logo" className="login-logo" />
          <h2>Staff Login</h2>
          <p>Sign in with your Google account to access your queue.</p>
          <button 
            className="login-btn" 
            style={{marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10}}
            onClick={async () => {
              const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
              if (error) setLoginError(true);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign in with Google
          </button>
          {loginError && <p className="login-error" style={{marginTop: 10}}>Error signing in. Please try again.</p>}
        </div>
      </div>
    );
  }

  // If session exists but role not fetched yet
  if (!userRole) {
    return <div style={{display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: 'white'}}>Loading Profile...</div>;
  }
`;

content = content.replace(loginUiStart, newLoginUi);

// 6. Update Staff Filter Dropdown visibility
const staffFilterBlock = `<div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <Users size={16} style={{opacity: 0.5}} />
            <span style={{fontSize: 14, opacity: 0.7}}>Staff:</span>
            <select 
              value={staffFilter} 
              onChange={e => setStaffFilter(e.target.value)}
              className="glass-input"
              style={{padding: '4px 8px'}}
            >
              <option value="All">All Staff</option>
              <option value="Unassigned">Unassigned</option>
              {staffList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>`;

const newStaffFilterBlock = `{userRole === 'admin' ? (
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <Users size={16} style={{opacity: 0.5}} />
            <span style={{fontSize: 14, opacity: 0.7}}>Staff:</span>
            <select 
              value={staffFilter} 
              onChange={e => setStaffFilter(e.target.value)}
              className="glass-input"
              style={{padding: '4px 8px'}}
            >
              <option value="All">All Staff</option>
              <option value="Unassigned">Unassigned</option>
              {staffList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
        ) : (
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <User size={16} style={{opacity: 0.5}} />
            <span style={{fontSize: 14, opacity: 0.7}}>Assigned to: <strong>{userStaffName || 'Unassigned'}</strong></span>
          </div>
        )}`;

content = content.replace(staffFilterBlock, newStaffFilterBlock);


// 7. Update Contact Details header Assignment drop down
const assignmentBlock = `<div style={{fontSize: 12, opacity: 0.7, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6}}>
                <User size={14} /> Assigned to:
                <select 
                  value={contacts[selectedNumber]?.assigned_to || ''} 
                  onChange={e => handleAssignContact(selectedNumber, e.target.value)}
                  style={{background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '2px 6px', fontSize: 12}}
                >
                  <option value="">Unassigned</option>
                  {staffList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>`;

const newAssignmentBlock = `{userRole === 'admin' ? (
              <div style={{fontSize: 12, opacity: 0.7, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6}}>
                <User size={14} /> Assigned to:
                <select 
                  value={contacts[selectedNumber]?.assigned_to || ''} 
                  onChange={e => handleAssignContact(selectedNumber, e.target.value)}
                  style={{background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '2px 6px', fontSize: 12}}
                >
                  <option value="">Unassigned</option>
                  {staffList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            ) : (
              <div style={{fontSize: 12, opacity: 0.7, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6}}>
                <User size={14} /> Assigned to: {contacts[selectedNumber]?.assigned_to || 'Unassigned'}
              </div>
            )}`;

content = content.replace(assignmentBlock, newAssignmentBlock);

// 8. Hide "Manage Staff" button for non-admins
const manageStaffBtn = `<button className="action-btn" onClick={() => setShowStaffModal(true)}>
            <User size={18} /> Manage Staff
          </button>`;

const newManageStaffBtn = `{userRole === 'admin' && (
          <button className="action-btn" onClick={() => setShowStaffModal(true)}>
            <User size={18} /> Manage Staff
          </button>
        )}`;
content = content.replace(manageStaffBtn, newManageStaffBtn);


fs.writeFileSync(file, content, 'utf8');
console.log('App.jsx successfully patched!');
