import React, { useState, useEffect, useCallback } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { 
  createEvent, 
  getEvent, 
  updateEvent, 
  addResponse, 
  getResponses,
  addChatMessage,
  getChatMessages,
  addDirectMessage,
  getDirectMessages,
  Timestamp
} from './firebase';

const SchedulingTool = () => {
  const [view, setView] = useState('create');
  const [isOrganizer, setIsOrganizer] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [eventData, setEventData] = useState({
    id: null,
    title: '',
    description: '',
    candidates: [{ id: 1, datetime: '' }],
    published: false,
    expiresAt: null,
    fixedCandidateId: null,
    venue: {
      enabled: false,
      name: '',
      address: '',
      website: '',
      imageUrl: '',
      reservationName: '',
      mapQuery: ''
    }
  });
  const [responses, setResponses] = useState([]);
  const [currentResponder, setCurrentResponder] = useState({ name: '', comment: '', answers: {} });
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [dmTarget, setDmTarget] = useState(null);
  const [dmInput, setDmInput] = useState('');
  const [directMessages, setDirectMessages] = useState([]);
  const [showDmPanel, setShowDmPanel] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showFixedShare, setShowFixedShare] = useState(false);
  const [fixedCopied, setFixedCopied] = useState(false);

  const { executeRecaptcha } = useGoogleReCaptcha();

  // URLからイベントID取得
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('event');
    if (eventId) {
      loadEvent(eventId);
    }
  }, []);

  // イベント読み込み
  const loadEvent = async (eventId) => {
    setLoading(true);
    try {
      const event = await getEvent(eventId);
      if (event) {
        setEventData({ ...event, published: true });
        setIsOrganizer(false);
        setView('results');
        setShareUrl(`${window.location.origin}?event=${eventId}`);
        
        // 回答・チャット読み込み
        const [resps, msgs] = await Promise.all([
          getResponses(eventId),
          getChatMessages(eventId)
        ]);
        setResponses(resps);
        setChatMessages(msgs);
      } else {
        setError('イベントが見つかりません');
      }
    } catch (err) {
      setError('読み込みエラー: ' + err.message);
    }
    setLoading(false);
  };

  // 有効期限カウントダウン
  useEffect(() => {
    if (eventData.expiresAt) {
      const interval = setInterval(() => {
        const now = new Date();
        const expires = eventData.expiresAt.toDate ? eventData.expiresAt.toDate() : new Date(eventData.expiresAt);
        const diff = expires - now;
        
        if (diff <= 0) {
          setTimeRemaining('EXPIRED');
          clearInterval(interval);
        } else {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          setTimeRemaining(`${days}d ${hours}h`);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [eventData.expiresAt]);

  const addCandidate = () => {
    if (eventData.candidates.length < 10) {
      setEventData(prev => ({
        ...prev,
        candidates: [...prev.candidates, { id: Date.now(), datetime: '' }]
      }));
    }
  };

  const removeCandidate = (id) => {
    if (eventData.candidates.length > 1) {
      setEventData(prev => ({
        ...prev,
        candidates: prev.candidates.filter(c => c.id !== id)
      }));
    }
  };

  const updateCandidate = (id, value) => {
    setEventData(prev => ({
      ...prev,
      candidates: prev.candidates.map(c => c.id === id ? { ...c, datetime: value } : c)
    }));
  };

  const updateVenue = (field, value) => {
    setEventData(prev => ({
      ...prev,
      venue: { ...prev.venue, [field]: value }
    }));
  };

  const calculateExpiry = () => {
    const validDates = eventData.candidates
      .filter(c => c.datetime)
      .map(c => new Date(c.datetime));
    
    if (validDates.length === 0) return null;
    
    const lastDate = new Date(Math.max(...validDates));
    lastDate.setDate(lastDate.getDate() + 1);
    lastDate.setHours(23, 59, 59, 999);
    return Timestamp.fromDate(lastDate);
  };

  // イベント公開（reCAPTCHA付き）
  const publishEvent = async () => {
    if (!executeRecaptcha) {
      setError('reCAPTCHA読み込み中...');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const recaptchaToken = await executeRecaptcha('create_event');
      
      const expiresAt = calculateExpiry();
      const eventPayload = {
        title: eventData.title,
        description: eventData.description,
        candidates: eventData.candidates.filter(c => c.datetime),
        venue: eventData.venue,
        expiresAt,
        fixedCandidateId: null
      };

      const eventId = await createEvent(eventPayload, recaptchaToken);
      
      const url = `${window.location.origin}?event=${eventId}`;
      setShareUrl(url);
      setEventData(prev => ({ ...prev, id: eventId, published: true, expiresAt }));
      setView('results');
      
      // URL更新
      window.history.pushState({}, '', `?event=${eventId}`);
    } catch (err) {
      setError('作成エラー: ' + err.message);
    }
    setLoading(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 回答送信
  const submitResponse = async () => {
    if (!currentResponder.name || Object.keys(currentResponder.answers).length === 0) return;
    
    setLoading(true);
    try {
      await addResponse(eventData.id, {
        name: currentResponder.name,
        comment: currentResponder.comment,
        answers: currentResponder.answers
      });
      
      // 再読み込み
      const resps = await getResponses(eventData.id);
      setResponses(resps);
      setCurrentUser(currentResponder.name);
      setCurrentResponder({ name: '', comment: '', answers: {} });
      setShowChat(true);
      setView('results');
    } catch (err) {
      setError('送信エラー: ' + err.message);
    }
    setLoading(false);
  };

  const setAnswer = (candidateId, status) => {
    setCurrentResponder(prev => ({
      ...prev,
      answers: { ...prev.answers, [candidateId]: status }
    }));
  };

  // チャット送信
  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    try {
      await addChatMessage(eventData.id, {
        user: isOrganizer ? 'Organizer' : currentUser,
        message: chatInput,
        isOrganizer
      });
      
      const msgs = await getChatMessages(eventData.id);
      setChatMessages(msgs);
      setChatInput('');
    } catch (err) {
      setError('送信エラー: ' + err.message);
    }
  };

  // DM送信
  const sendDm = async () => {
    if (!dmInput.trim() || !dmTarget) return;
    
    try {
      await addDirectMessage(eventData.id, {
        from: 'Organizer',
        to: dmTarget,
        message: dmInput
      });
      
      const dms = await getDirectMessages(eventData.id);
      setDirectMessages(dms);
      setDmInput('');
      setDmTarget(null);
    } catch (err) {
      setError('送信エラー: ' + err.message);
    }
  };

  // FIX機能
  const fixCandidate = async (candidateId) => {
    try {
      await updateEvent(eventData.id, { fixedCandidateId: candidateId });
      setEventData(prev => ({ ...prev, fixedCandidateId: candidateId }));
      setShowFixedShare(true);
    } catch (err) {
      setError('更新エラー: ' + err.message);
    }
  };

  const unfixCandidate = async () => {
    try {
      await updateEvent(eventData.id, { fixedCandidateId: null });
      setEventData(prev => ({ ...prev, fixedCandidateId: null }));
      setShowFixedShare(false);
    } catch (err) {
      setError('更新エラー: ' + err.message);
    }
  };

  const getVoteCounts = (candidateId) => {
    const counts = { available: 0, unavailable: 0, maybe: 0 };
    responses.forEach(r => {
      if (r.answers[candidateId] === 'available') counts.available++;
      if (r.answers[candidateId] === 'unavailable') counts.unavailable++;
      if (r.answers[candidateId] === 'maybe') counts.maybe++;
    });
    return counts;
  };

  const getBestCandidate = () => {
    let best = null;
    let maxAvailable = -1;
    eventData.candidates.forEach(c => {
      const counts = getVoteCounts(c.id);
      if (counts.available > maxAvailable) {
        maxAvailable = counts.available;
        best = c.id;
      }
    });
    return maxAvailable > 0 ? best : null;
  };

  const formatDatetimeForShare = (datetime) => {
    if (!datetime) return '';
    const date = new Date(datetime);
    return date.toISOString().replace(/-|:|\.\d{3}/g, '');
  };

  const getShareLinks = (candidate) => {
    const title = encodeURIComponent(eventData.title);
    const desc = encodeURIComponent(eventData.description);
    const datetime = candidate.datetime;
    const startDate = formatDatetimeForShare(datetime);
    const endDate = formatDatetimeForShare(new Date(new Date(datetime).getTime() + 3600000));
    
    return {
      google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${desc}&dates=${startDate}/${endDate}`,
      zoom: `https://zoom.us/schedule?topic=${title}`,
      teams: `https://teams.microsoft.com/l/meeting/new?subject=${title}&content=${desc}`,
      mail: `mailto:?subject=${title}&body=${desc}%0A%0A日時: ${datetime}`,
      line: `https://line.me/R/msg/text/?${title}%0A${desc}%0A日時: ${datetime}`
    };
  };

  const openGoogleMaps = () => {
    const query = eventData.venue.mapQuery || eventData.venue.address || eventData.venue.name;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
  };

  const getFixedCandidate = () => {
    return eventData.candidates.find(c => c.id === eventData.fixedCandidateId);
  };

  const getFixedShareText = () => {
    const fixed = getFixedCandidate();
    if (!fixed) return '';
    
    const dateStr = new Date(fixed.datetime).toLocaleString('ja-JP', {
      year: 'numeric', month: 'numeric', day: 'numeric',
      weekday: 'short', hour: '2-digit', minute: '2-digit'
    });
    
    let text = `【確定】${eventData.title}\n日時: ${dateStr}`;
    
    if (eventData.venue.enabled) {
      if (eventData.venue.name) text += `\n会場: ${eventData.venue.name}`;
      if (eventData.venue.address) text += `\n住所: ${eventData.venue.address}`;
    }
    
    return text;
  };

  const copyFixedInfo = () => {
    navigator.clipboard.writeText(getFixedShareText());
    setFixedCopied(true);
    setTimeout(() => setFixedCopied(false), 2000);
  };

  const getFixedShareLinks = () => {
    const fixed = getFixedCandidate();
    if (!fixed) return {};
    
    const title = encodeURIComponent(`【確定】${eventData.title}`);
    const startDate = formatDatetimeForShare(fixed.datetime);
    const endDate = formatDatetimeForShare(new Date(new Date(fixed.datetime).getTime() + 3600000));
    const shareText = encodeURIComponent(getFixedShareText());
    
    return {
      google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}`,
      mail: `mailto:?subject=${title}&body=${shareText}`,
      line: `https://line.me/R/msg/text/?${shareText}`
    };
  };

  const bestCandidateId = getBestCandidate();
  const fixedCandidateId = eventData.fixedCandidateId;

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading && !eventData.published) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingScreen}>
          <div style={styles.spinner} />
          <span>読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.gridOverlay} />
      <div style={styles.content}>
        <header style={styles.header}>
          <div style={styles.logo}>
            <div style={styles.logoMark}>
              <div style={styles.logoLine1} />
              <div style={styles.logoLine2} />
              <div style={styles.logoLine3} />
            </div>
            <span style={styles.logoText}>SCHEDULE</span>
          </div>
          <p style={styles.tagline}>Coordinate your time seamlessly</p>
        </header>

        {error && (
          <div style={styles.errorBanner}>
            {error}
            <button style={styles.errorClose} onClick={() => setError(null)}>×</button>
          </div>
        )}

        {view === 'create' && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardLabel}>NEW EVENT</span>
              <h2 style={styles.cardTitle}>イベント作成</h2>
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>イベント名</label>
              <input
                type="text"
                style={styles.input}
                value={eventData.title}
                onChange={(e) => setEventData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="例：チームミーティング"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>概要</label>
              <textarea
                style={styles.textarea}
                value={eventData.description}
                onChange={(e) => setEventData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="イベントの詳細を入力してください..."
                rows={3}
              />
            </div>

            <div style={styles.formGroup}>
              <div style={styles.labelRow}>
                <label style={styles.label}>候補日時</label>
                <span style={styles.counter}>{eventData.candidates.length} / 10</span>
              </div>
              <div style={styles.candidatesList}>
                {eventData.candidates.map((candidate, index) => (
                  <div key={candidate.id} style={styles.candidateRow}>
                    <span style={styles.candidateNumber}>{String(index + 1).padStart(2, '0')}</span>
                    <input
                      type="datetime-local"
                      style={styles.datetimeInput}
                      value={candidate.datetime}
                      onChange={(e) => updateCandidate(candidate.id, e.target.value)}
                    />
                    <button
                      style={{...styles.removeBtn, opacity: eventData.candidates.length === 1 ? 0.3 : 1}}
                      onClick={() => removeCandidate(candidate.id)}
                      disabled={eventData.candidates.length === 1}
                    >
                      <span style={styles.removeLine1} />
                      <span style={styles.removeLine2} />
                    </button>
                  </div>
                ))}
              </div>
              {eventData.candidates.length < 10 && (
                <button style={styles.addBtn} onClick={addCandidate}>
                  <span style={styles.addIcon}>+</span>
                  <span>候補を追加</span>
                </button>
              )}
            </div>

            <div style={styles.venueSection}>
              <div style={styles.venueToggle} onClick={() => updateVenue('enabled', !eventData.venue.enabled)}>
                <div style={{...styles.toggleBox, ...(eventData.venue.enabled ? styles.toggleBoxActive : {})}}>
                  {eventData.venue.enabled && <span style={styles.checkMark} />}
                </div>
                <span style={styles.venueToggleLabel}>オフライン開催（会場情報を追加）</span>
              </div>

              {eventData.venue.enabled && (
                <div style={styles.venueFields}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>会場名</label>
                    <input type="text" style={styles.input} value={eventData.venue.name} onChange={(e) => updateVenue('name', e.target.value)} placeholder="例：会議室A" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>住所</label>
                    <input type="text" style={styles.input} value={eventData.venue.address} onChange={(e) => updateVenue('address', e.target.value)} placeholder="例：東京都渋谷区..." />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>会場Webサイト</label>
                    <input type="url" style={styles.input} value={eventData.venue.website} onChange={(e) => updateVenue('website', e.target.value)} placeholder="https://..." />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>会場画像URL</label>
                    <input type="url" style={styles.input} value={eventData.venue.imageUrl} onChange={(e) => updateVenue('imageUrl', e.target.value)} placeholder="https://..." />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>予約名義</label>
                    <input type="text" style={styles.input} value={eventData.venue.reservationName} onChange={(e) => updateVenue('reservationName', e.target.value)} placeholder="例：山田" />
                  </div>
                </div>
              )}
            </div>

            <button
              style={{...styles.publishBtn, opacity: (!eventData.title || eventData.candidates.every(c => !c.datetime) || loading) ? 0.5 : 1}}
              onClick={publishEvent}
              disabled={!eventData.title || eventData.candidates.every(c => !c.datetime) || loading}
            >
              <span>{loading ? '作成中...' : '公開する'}</span>
              {!loading && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              )}
            </button>
            
            <div style={styles.recaptchaNote}>
              This site is protected by reCAPTCHA
            </div>
          </div>
        )}

        {view === 'results' && (
          <div style={styles.card}>
            <div style={styles.eventHeader}>
              <div style={styles.eventHeaderTop}>
                <span style={styles.cardLabel}>EVENT</span>
                {fixedCandidateId ? (
                  <span style={styles.fixedBadge}>FIXED</span>
                ) : timeRemaining && (
                  <span style={{...styles.expiryBadge, ...(timeRemaining === 'EXPIRED' ? styles.expiredBadge : {})}}>
                    {timeRemaining === 'EXPIRED' ? 'EXPIRED' : `EXPIRES IN ${timeRemaining}`}
                  </span>
                )}
              </div>
              <h2 style={styles.eventTitle}>{eventData.title}</h2>
              {eventData.description && <p style={styles.eventDesc}>{eventData.description}</p>}
            </div>

            {fixedCandidateId && (
              <div style={styles.fixedBanner}>
                <div style={styles.fixedBannerHeader}>
                  <span style={styles.cardLabel}>CONFIRMED SCHEDULE</span>
                  {isOrganizer && <button style={styles.unfixBtn} onClick={unfixCandidate}>Unfix</button>}
                </div>
                <div style={styles.fixedDateTime}>
                  {getFixedCandidate() && new Date(getFixedCandidate().datetime).toLocaleString('ja-JP', {
                    year: 'numeric', month: 'numeric', day: 'numeric',
                    weekday: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
                <div style={styles.fixedShareSection}>
                  <button style={styles.fixedShareToggle} onClick={() => setShowFixedShare(!showFixedShare)}>
                    {showFixedShare ? 'Hide Share Options' : 'Share Fixed Schedule'}
                  </button>
                  {showFixedShare && (
                    <div style={styles.fixedShareOptions}>
                      <div style={styles.fixedShareText}>
                        <pre style={styles.fixedSharePre}>{getFixedShareText()}</pre>
                        <button style={styles.copyBtn} onClick={copyFixedInfo}>{fixedCopied ? 'Copied' : 'Copy'}</button>
                      </div>
                      <div style={styles.fixedShareLinks}>
                        <a href={getFixedShareLinks().google} target="_blank" rel="noopener noreferrer" style={styles.fixedShareLink}>Google Calendar</a>
                        <a href={getFixedShareLinks().mail} target="_blank" rel="noopener noreferrer" style={styles.fixedShareLink}>Mail</a>
                        <a href={getFixedShareLinks().line} target="_blank" rel="noopener noreferrer" style={styles.fixedShareLink}>LINE</a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {eventData.venue?.enabled && (
              <div style={styles.venueDisplay}>
                <div style={styles.venueDisplayHeader}><span style={styles.cardLabel}>VENUE</span></div>
                {eventData.venue.imageUrl && (
                  <div style={styles.venueDisplayImage}>
                    <img src={eventData.venue.imageUrl} alt="Venue" style={styles.venueImageLarge} onError={(e) => e.target.style.display = 'none'} />
                  </div>
                )}
                <div style={styles.venueInfo}>
                  {eventData.venue.name && <div style={styles.venueInfoRow}><span style={styles.venueInfoLabel}>会場名</span><span style={styles.venueInfoValue}>{eventData.venue.name}</span></div>}
                  {eventData.venue.address && <div style={styles.venueInfoRow}><span style={styles.venueInfoLabel}>住所</span><span style={styles.venueInfoValue}>{eventData.venue.address}</span></div>}
                  {eventData.venue.reservationName && <div style={styles.venueInfoRow}><span style={styles.venueInfoLabel}>予約名義</span><span style={styles.venueInfoValue}>{eventData.venue.reservationName}</span></div>}
                </div>
                <div style={styles.venueActions}>
                  {eventData.venue.website && <a href={eventData.venue.website} target="_blank" rel="noopener noreferrer" style={styles.venueActionBtn}>Website</a>}
                  <button style={styles.venueActionBtn} onClick={openGoogleMaps}>Google Maps</button>
                </div>
              </div>
            )}

            <div style={styles.shareUrlBox}>
              <label style={styles.label}>招待URL</label>
              <div style={styles.urlRow}>
                <input type="text" style={styles.urlInput} value={shareUrl} readOnly />
                <button style={styles.copyBtn} onClick={copyToClipboard}>{copied ? 'Copied' : 'Copy'}</button>
              </div>
            </div>

            <div style={styles.tabBar}>
              <button style={{...styles.tab, ...(!showChat ? styles.tabActive : {})}} onClick={() => setShowChat(false)}>回答状況</button>
              <button style={styles.tab} onClick={() => setView('respond')}>回答する</button>
              <button style={{...styles.tab, ...(showChat ? styles.tabActive : {})}} onClick={() => setShowChat(true)}>
                Chat {chatMessages.length > 0 && `(${chatMessages.length})`}
              </button>
            </div>

            {showChat ? (
              <div style={styles.chatSection}>
                <div style={styles.chatMessages}>
                  {chatMessages.length === 0 ? (
                    <div style={styles.chatEmpty}>メッセージはまだありません</div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div key={msg.id} style={{...styles.chatMessage, ...(msg.isOrganizer ? styles.chatMessageOrganizer : {})}}>
                        <div style={styles.chatMessageHeader}>
                          <span style={styles.chatUser}>
                            {msg.user}
                            {msg.isOrganizer && <span style={styles.organizerBadge}>HOST</span>}
                          </span>
                          <span style={styles.chatTime}>{formatTime(msg.createdAt)}</span>
                        </div>
                        <div style={styles.chatText}>{msg.message}</div>
                      </div>
                    ))
                  )}
                </div>
                <div style={styles.chatInputRow}>
                  <input type="text" style={styles.chatInput} value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="メッセージを入力..." onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()} />
                  <button style={styles.chatSendBtn} onClick={sendChatMessage}>Send</button>
                </div>
              </div>
            ) : (
              <>
                <div style={styles.resultsTable}>
                  <div style={styles.tableHeader}>
                    <div style={styles.headerCellDate}>日時</div>
                    <div style={styles.headerCellVote}>可能</div>
                    <div style={styles.headerCellVote}>調整中</div>
                    <div style={styles.headerCellVote}>不可</div>
                    <div style={styles.headerCellAction}>{isOrganizer ? 'FIX' : '共有'}</div>
                  </div>
                  {eventData.candidates.filter(c => c.datetime).map((candidate) => {
                    const counts = getVoteCounts(candidate.id);
                    const isBest = candidate.id === bestCandidateId && !fixedCandidateId;
                    const isFixed = candidate.id === fixedCandidateId;
                    const links = getShareLinks(candidate);
                    return (
                      <div key={candidate.id} style={{...styles.tableRow, ...(isFixed ? styles.fixedRow : isBest ? styles.bestRow : {})}}>
                        <div style={styles.dateCell}>
                          {isFixed ? <span style={styles.fixedBadgeSmall}>FIXED</span> : isBest && <span style={styles.bestBadge}>BEST</span>}
                          <span style={styles.dateText}>
                            {new Date(candidate.datetime).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{...styles.countCell, ...styles.available}}>{counts.available}</div>
                        <div style={{...styles.countCell, ...styles.maybe}}>{counts.maybe}</div>
                        <div style={{...styles.countCell, ...styles.unavailable}}>{counts.unavailable}</div>
                        <div style={styles.actionCell}>
                          {isOrganizer ? (
                            isFixed ? <button style={styles.unfixBtnSmall} onClick={unfixCandidate}>Unfix</button>
                            : <button style={styles.fixBtn} onClick={() => fixCandidate(candidate.id)} disabled={fixedCandidateId !== null}>Fix</button>
                          ) : (
                            <button style={styles.shareBtn} onClick={() => setShowShareMenu(showShareMenu === candidate.id ? null : candidate.id)}>Share</button>
                          )}
                          {showShareMenu === candidate.id && !isOrganizer && (
                            <div style={styles.shareMenu}>
                              <a href={links.google} target="_blank" rel="noopener noreferrer" style={styles.shareLink}>Google Calendar</a>
                              <a href={links.zoom} target="_blank" rel="noopener noreferrer" style={styles.shareLink}>Zoom</a>
                              <a href={links.teams} target="_blank" rel="noopener noreferrer" style={styles.shareLink}>Microsoft Teams</a>
                              <a href={links.mail} target="_blank" rel="noopener noreferrer" style={styles.shareLink}>Mail</a>
                              <a href={links.line} target="_blank" rel="noopener noreferrer" style={styles.shareLink}>LINE</a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {responses.length > 0 && (
                  <div style={styles.responsesList}>
                    <div style={styles.responsesHeader}>
                      <span style={styles.cardLabel}>RESPONSES</span>
                      <span style={styles.responseCount}>{responses.length}</span>
                    </div>
                    {responses.map((r) => (
                      <div key={r.id} style={styles.responseCard}>
                        <div style={styles.responseCardHeader}>
                          <div style={styles.responderName}>{r.name}</div>
                          {isOrganizer && <button style={styles.dmBtn} onClick={() => { setDmTarget(r.name); setShowDmPanel(true); }}>DM</button>}
                        </div>
                        <div style={styles.responderAnswers}>
                          {eventData.candidates.filter(c => c.datetime).map((c) => (
                            <span key={c.id} style={{
                              ...styles.answerChip,
                              ...(r.answers[c.id] === 'available' ? styles.chipAvailable : {}),
                              ...(r.answers[c.id] === 'maybe' ? styles.chipMaybe : {}),
                              ...(r.answers[c.id] === 'unavailable' ? styles.chipUnavailable : {})
                            }}>
                              {r.answers[c.id] === 'available' && 'O'}
                              {r.answers[c.id] === 'maybe' && '?'}
                              {r.answers[c.id] === 'unavailable' && 'X'}
                              {!r.answers[c.id] && '-'}
                            </span>
                          ))}
                        </div>
                        {r.comment && <div style={styles.responderComment}>{r.comment}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {showDmPanel && (
              <div style={styles.dmOverlay} onClick={() => setShowDmPanel(false)}>
                <div style={styles.dmPanel} onClick={(e) => e.stopPropagation()}>
                  <div style={styles.dmHeader}>
                    <span style={styles.cardLabel}>DIRECT MESSAGE</span>
                    <button style={styles.dmCloseBtn} onClick={() => setShowDmPanel(false)}>
                      <span style={styles.removeLine1} /><span style={styles.removeLine2} />
                    </button>
                  </div>
                  <div style={styles.dmList}>
                    {directMessages.filter(dm => dm.to === dmTarget).map((dm) => (
                      <div key={dm.id} style={styles.dmMessage}>
                        <div style={styles.dmMessageHeader}>
                          <span style={styles.dmTo}>To: {dm.to}</span>
                          <span style={styles.chatTime}>{formatTime(dm.createdAt)}</span>
                        </div>
                        <div style={styles.dmText}>{dm.message}</div>
                      </div>
                    ))}
                  </div>
                  {dmTarget && (
                    <div style={styles.dmInputSection}>
                      <div style={styles.dmTargetLabel}>To: {dmTarget}</div>
                      <div style={styles.chatInputRow}>
                        <input type="text" style={styles.chatInput} value={dmInput} onChange={(e) => setDmInput(e.target.value)} placeholder="DMを入力..." onKeyPress={(e) => e.key === 'Enter' && sendDm()} />
                        <button style={styles.chatSendBtn} onClick={sendDm}>Send</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'respond' && (
          <div style={styles.card}>
            <div style={styles.eventHeader}>
              <div style={styles.eventHeaderTop}>
                <span style={styles.cardLabel}>RESPOND</span>
                {fixedCandidateId && <span style={styles.fixedBadge}>FIXED</span>}
              </div>
              <h2 style={styles.eventTitle}>{eventData.title}</h2>
              {eventData.description && <p style={styles.eventDesc}>{eventData.description}</p>}
            </div>

            {fixedCandidateId && (
              <div style={styles.fixedBannerRespond}>
                <span style={styles.cardLabel}>CONFIRMED</span>
                <div style={styles.fixedDateTimeSmall}>
                  {getFixedCandidate() && new Date(getFixedCandidate().datetime).toLocaleString('ja-JP', {
                    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>
            )}

            {eventData.venue?.enabled && (
              <div style={styles.venueDisplay}>
                <div style={styles.venueDisplayHeader}><span style={styles.cardLabel}>VENUE</span></div>
                <div style={styles.venueInfo}>
                  {eventData.venue.name && <div style={styles.venueInfoRow}><span style={styles.venueInfoLabel}>会場名</span><span style={styles.venueInfoValue}>{eventData.venue.name}</span></div>}
                  {eventData.venue.address && <div style={styles.venueInfoRow}><span style={styles.venueInfoLabel}>住所</span><span style={styles.venueInfoValue}>{eventData.venue.address}</span></div>}
                </div>
                <div style={styles.venueActions}>
                  <button style={styles.venueActionBtn} onClick={openGoogleMaps}>Google Maps</button>
                </div>
              </div>
            )}

            <div style={styles.tabBar}>
              <button style={styles.tab} onClick={() => setView('results')}>回答状況</button>
              <button style={{...styles.tab, ...styles.tabActive}}>回答する</button>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>お名前</label>
              <input type="text" style={styles.input} value={currentResponder.name} onChange={(e) => setCurrentResponder(prev => ({ ...prev, name: e.target.value }))} placeholder="山田 太郎" />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>回答</label>
              <div style={styles.answerGrid}>
                {eventData.candidates.filter(c => c.datetime).map((candidate) => {
                  const isFixed = candidate.id === fixedCandidateId;
                  return (
                    <div key={candidate.id} style={{...styles.answerRow, ...(isFixed ? styles.answerRowFixed : {})}}>
                      <div style={styles.answerDate}>
                        {isFixed && <span style={styles.fixedBadgeTiny}>FIXED</span>}
                        {new Date(candidate.datetime).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={styles.answerBtns}>
                        <button style={{...styles.answerBtn, ...(currentResponder.answers[candidate.id] === 'available' ? styles.answerBtnActiveGreen : {})}} onClick={() => setAnswer(candidate.id, 'available')}>O</button>
                        <button style={{...styles.answerBtn, ...(currentResponder.answers[candidate.id] === 'maybe' ? styles.answerBtnActiveYellow : {})}} onClick={() => setAnswer(candidate.id, 'maybe')}>?</button>
                        <button style={{...styles.answerBtn, ...(currentResponder.answers[candidate.id] === 'unavailable' ? styles.answerBtnActiveRed : {})}} onClick={() => setAnswer(candidate.id, 'unavailable')}>X</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>コメント（任意）</label>
              <textarea style={styles.textarea} value={currentResponder.comment} onChange={(e) => setCurrentResponder(prev => ({ ...prev, comment: e.target.value }))} placeholder="ひとこと添えてください..." rows={2} />
            </div>

            <button
              style={{...styles.submitBtn, opacity: (!currentResponder.name || Object.keys(currentResponder.answers).length === 0 || loading) ? 0.5 : 1}}
              onClick={submitResponse}
              disabled={!currentResponder.name || Object.keys(currentResponder.answers).length === 0 || loading}
            >
              <span>{loading ? '送信中...' : '送信する'}</span>
              {!loading && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
            </button>
          </div>
        )}

        <footer style={styles.footer}>
          <span>Schedule Coordinator</span>
        </footer>
      </div>
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', background: '#0a0a0a', fontFamily: '"Helvetica Neue", "Noto Sans JP", sans-serif', position: 'relative', color: '#fff' },
  gridOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`, backgroundSize: '60px 60px', pointerEvents: 'none' },
  content: { position: 'relative', maxWidth: '640px', margin: '0 auto', padding: '60px 24px' },
  loadingScreen: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', color: 'rgba(255,255,255,0.6)' },
  spinner: { width: '32px', height: '32px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  header: { marginBottom: '48px' },
  logo: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' },
  logoMark: { width: '32px', height: '32px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' },
  logoLine1: { height: '2px', background: '#fff', width: '100%' },
  logoLine2: { height: '2px', background: '#fff', width: '70%' },
  logoLine3: { height: '2px', background: '#fff', width: '85%' },
  logoText: { fontSize: '13px', fontWeight: '500', letterSpacing: '4px', color: '#fff' },
  tagline: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0, fontWeight: '300', letterSpacing: '0.5px' },
  errorBanner: { background: 'rgba(248, 113, 113, 0.15)', border: '1px solid rgba(248, 113, 113, 0.3)', color: '#f87171', padding: '12px 16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' },
  errorClose: { background: 'none', border: 'none', color: '#f87171', fontSize: '18px', cursor: 'pointer' },
  card: { background: 'rgba(255,255,255,0.03)', borderRadius: '2px', padding: '40px', border: '1px solid rgba(255,255,255,0.08)' },
  cardHeader: { marginBottom: '36px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  cardLabel: { fontSize: '10px', fontWeight: '500', letterSpacing: '2px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', display: 'block' },
  cardTitle: { color: '#fff', fontSize: '24px', fontWeight: '300', margin: 0, letterSpacing: '-0.5px' },
  formGroup: { marginBottom: '28px' },
  labelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  label: { display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: '500', marginBottom: '10px', letterSpacing: '1px', textTransform: 'uppercase' },
  counter: { fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' },
  input: { width: '100%', padding: '16px 0', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '16px', outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '16px 0', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '16px', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.6 },
  candidatesList: { display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.05)' },
  candidateRow: { display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: '#0a0a0a' },
  candidateNumber: { fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', width: '24px' },
  datetimeInput: { flex: 1, padding: '12px 0', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '14px', outline: 'none', colorScheme: 'dark' },
  removeBtn: { width: '32px', height: '32px', border: 'none', background: 'transparent', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  removeLine1: { position: 'absolute', width: '14px', height: '1px', background: 'rgba(255,255,255,0.4)', transform: 'rotate(45deg)' },
  removeLine2: { position: 'absolute', width: '14px', height: '1px', background: 'rgba(255,255,255,0.4)', transform: 'rotate(-45deg)' },
  addBtn: { marginTop: '1px', padding: '16px', background: 'rgba(255,255,255,0.02)', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '13px', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  addIcon: { fontSize: '16px', fontWeight: '300' },
  publishBtn: { width: '100%', padding: '18px 24px', background: '#fff', border: 'none', color: '#0a0a0a', fontSize: '13px', fontWeight: '500', cursor: 'pointer', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', letterSpacing: '1px' },
  recaptchaNote: { textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '16px' },
  venueSection: { marginBottom: '28px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' },
  venueToggle: { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '20px' },
  toggleBox: { width: '20px', height: '20px', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  toggleBoxActive: { background: '#fff', borderColor: '#fff' },
  checkMark: { width: '10px', height: '6px', borderLeft: '2px solid #0a0a0a', borderBottom: '2px solid #0a0a0a', transform: 'rotate(-45deg) translateY(-1px)' },
  venueToggleLabel: { fontSize: '13px', color: 'rgba(255,255,255,0.7)' },
  venueFields: { paddingLeft: '32px' },
  eventHeader: { marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  eventHeaderTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  expiryBadge: { fontSize: '9px', fontWeight: '500', letterSpacing: '1px', color: 'rgba(255,255,255,0.5)', padding: '4px 8px', border: '1px solid rgba(255,255,255,0.2)' },
  expiredBadge: { color: '#f87171', borderColor: '#f87171' },
  fixedBadge: { fontSize: '9px', fontWeight: '600', letterSpacing: '1px', color: '#0a0a0a', background: '#4ade80', padding: '4px 10px' },
  eventTitle: { color: '#fff', fontSize: '28px', fontWeight: '300', margin: '0 0 12px 0', letterSpacing: '-0.5px' },
  eventDesc: { color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0, lineHeight: 1.7, fontWeight: '300' },
  fixedBanner: { marginBottom: '32px', padding: '24px', background: 'rgba(74, 222, 128, 0.08)', border: '1px solid rgba(74, 222, 128, 0.2)' },
  fixedBannerHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  fixedDateTime: { fontSize: '20px', fontWeight: '500', color: '#fff', marginBottom: '20px' },
  unfixBtn: { padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)', fontSize: '10px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' },
  fixedShareSection: { borderTop: '1px solid rgba(74, 222, 128, 0.2)', paddingTop: '16px' },
  fixedShareToggle: { padding: '10px 16px', background: 'rgba(74, 222, 128, 0.15)', border: '1px solid rgba(74, 222, 128, 0.3)', color: '#4ade80', fontSize: '11px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase', width: '100%' },
  fixedShareOptions: { marginTop: '16px' },
  fixedShareText: { background: 'rgba(0,0,0,0.3)', padding: '16px', marginBottom: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' },
  fixedSharePre: { flex: 1, margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6 },
  fixedShareLinks: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  fixedShareLink: { padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '11px', textDecoration: 'none', letterSpacing: '0.5px', textTransform: 'uppercase' },
  fixedBannerRespond: { marginBottom: '24px', padding: '16px', background: 'rgba(74, 222, 128, 0.08)', border: '1px solid rgba(74, 222, 128, 0.2)' },
  fixedDateTimeSmall: { fontSize: '16px', fontWeight: '500', color: '#4ade80', marginTop: '8px' },
  venueDisplay: { marginBottom: '32px', padding: '24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' },
  venueDisplayHeader: { marginBottom: '16px' },
  venueDisplayImage: { marginBottom: '20px', border: '1px solid rgba(255,255,255,0.1)' },
  venueImageLarge: { width: '100%', height: '180px', objectFit: 'cover', display: 'block' },
  venueInfo: { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' },
  venueInfoRow: { display: 'flex', gap: '16px' },
  venueInfoLabel: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', width: '80px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.5px' },
  venueInfoValue: { fontSize: '14px', color: '#fff' },
  venueActions: { display: 'flex', gap: '8px' },
  venueActionBtn: { padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '11px', cursor: 'pointer', letterSpacing: '0.5px', textDecoration: 'none', textTransform: 'uppercase' },
  shareUrlBox: { marginBottom: '32px' },
  urlRow: { display: 'flex', gap: '1px', background: 'rgba(255,255,255,0.1)' },
  urlInput: { flex: 1, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: '12px', outline: 'none', fontFamily: 'monospace' },
  copyBtn: { padding: '14px 24px', background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '500', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' },
  tabBar: { display: 'flex', gap: '1px', marginBottom: '32px', background: 'rgba(255,255,255,0.1)' },
  tab: { flex: 1, padding: '14px', background: 'rgba(255,255,255,0.02)', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '12px', cursor: 'pointer', letterSpacing: '0.5px' },
  tabActive: { background: 'rgba(255,255,255,0.08)', color: '#fff' },
  chatSection: { border: '1px solid rgba(255,255,255,0.08)' },
  chatMessages: { height: '300px', overflowY: 'auto', padding: '20px' },
  chatEmpty: { color: 'rgba(255,255,255,0.3)', fontSize: '13px', textAlign: 'center', padding: '40px 0' },
  chatMessage: { marginBottom: '16px', padding: '12px 16px', background: 'rgba(255,255,255,0.03)' },
  chatMessageOrganizer: { borderLeft: '2px solid #fff' },
  chatMessageHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' },
  chatUser: { fontSize: '12px', fontWeight: '500', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' },
  organizerBadge: { fontSize: '9px', padding: '2px 6px', background: '#fff', color: '#0a0a0a', fontWeight: '600', letterSpacing: '0.5px' },
  chatTime: { fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' },
  chatText: { fontSize: '14px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 },
  chatInputRow: { display: 'flex', gap: '1px', borderTop: '1px solid rgba(255,255,255,0.08)' },
  chatInput: { flex: 1, padding: '16px', background: 'rgba(255,255,255,0.02)', border: 'none', color: '#fff', fontSize: '14px', outline: 'none' },
  chatSendBtn: { padding: '16px 24px', background: '#fff', border: 'none', color: '#0a0a0a', fontSize: '11px', fontWeight: '500', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' },
  resultsTable: { border: '1px solid rgba(255,255,255,0.08)' },
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px', gap: '1px', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase' },
  headerCellDate: {},
  headerCellVote: { textAlign: 'center' },
  headerCellAction: { textAlign: 'right' },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px', gap: '1px', padding: '20px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' },
  bestRow: { background: 'rgba(255,255,255,0.05)', borderLeft: '2px solid #fff', marginLeft: '-1px' },
  fixedRow: { background: 'rgba(74, 222, 128, 0.1)', borderLeft: '2px solid #4ade80', marginLeft: '-1px' },
  dateCell: { display: 'flex', alignItems: 'center', gap: '12px' },
  dateText: { color: '#fff', fontSize: '14px', fontWeight: '400' },
  bestBadge: { fontSize: '9px', fontWeight: '600', letterSpacing: '1px', color: '#0a0a0a', background: '#fff', padding: '4px 8px' },
  fixedBadgeSmall: { fontSize: '9px', fontWeight: '600', letterSpacing: '1px', color: '#0a0a0a', background: '#4ade80', padding: '4px 8px' },
  fixedBadgeTiny: { fontSize: '8px', fontWeight: '600', letterSpacing: '0.5px', color: '#0a0a0a', background: '#4ade80', padding: '2px 6px', marginRight: '8px' },
  countCell: { textAlign: 'center', fontSize: '15px', fontWeight: '500', fontFamily: 'monospace' },
  available: { color: '#4ade80' },
  maybe: { color: '#fbbf24' },
  unavailable: { color: '#f87171' },
  actionCell: { position: 'relative', textAlign: 'right' },
  shareBtn: { padding: '8px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', fontSize: '10px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' },
  fixBtn: { padding: '8px 12px', background: 'rgba(74, 222, 128, 0.15)', border: '1px solid rgba(74, 222, 128, 0.4)', color: '#4ade80', fontSize: '10px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' },
  unfixBtnSmall: { padding: '8px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)', fontSize: '10px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' },
  shareMenu: { position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: '#141414', padding: '8px 0', minWidth: '180px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', zIndex: 100, border: '1px solid rgba(255,255,255,0.1)' },
  shareLink: { display: 'block', padding: '12px 20px', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '12px', letterSpacing: '0.3px' },
  responsesList: { marginTop: '32px', paddingTop: '32px', borderTop: '1px solid rgba(255,255,255,0.08)' },
  responsesHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' },
  responseCount: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' },
  responseCard: { padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  responseCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  responderName: { color: '#fff', fontWeight: '500', fontSize: '14px' },
  dmBtn: { padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)', fontSize: '10px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' },
  responderAnswers: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' },
  answerChip: { width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.03)', fontFamily: 'monospace' },
  chipAvailable: { color: '#4ade80', background: 'rgba(74, 222, 128, 0.1)' },
  chipMaybe: { color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)' },
  chipUnavailable: { color: '#f87171', background: 'rgba(248, 113, 113, 0.1)' },
  responderComment: { color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '12px', fontStyle: 'italic', fontWeight: '300' },
  answerGrid: { display: 'flex', flexDirection: 'column' },
  answerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  answerRowFixed: { background: 'rgba(74, 222, 128, 0.05)', margin: '0 -20px', padding: '20px' },
  answerDate: { color: '#fff', fontSize: '14px', fontWeight: '400', display: 'flex', alignItems: 'center' },
  answerBtns: { display: 'flex', gap: '8px' },
  answerBtn: { width: '44px', height: '44px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: '14px', cursor: 'pointer', fontFamily: 'monospace' },
  answerBtnActiveGreen: { background: 'rgba(74, 222, 128, 0.15)', borderColor: '#4ade80', color: '#4ade80' },
  answerBtnActiveYellow: { background: 'rgba(251, 191, 36, 0.15)', borderColor: '#fbbf24', color: '#fbbf24' },
  answerBtnActiveRed: { background: 'rgba(248, 113, 113, 0.15)', borderColor: '#f87171', color: '#f87171' },
  submitBtn: { width: '100%', padding: '18px 24px', background: '#fff', border: 'none', color: '#0a0a0a', fontSize: '13px', fontWeight: '500', cursor: 'pointer', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', letterSpacing: '1px' },
  dmOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  dmPanel: { width: '90%', maxWidth: '480px', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' },
  dmHeader: { padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  dmCloseBtn: { width: '32px', height: '32px', border: 'none', background: 'transparent', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dmList: { flex: 1, overflowY: 'auto', padding: '20px' },
  dmMessage: { marginBottom: '16px', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderLeft: '2px solid rgba(255,255,255,0.2)' },
  dmMessageHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' },
  dmTo: { fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  dmText: { fontSize: '14px', color: '#fff', lineHeight: 1.5 },
  dmInputSection: { padding: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' },
  dmTargetLabel: { fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  footer: { marginTop: '48px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }
};

export default SchedulingTool;
