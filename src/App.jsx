import React, { useState, useEffect } from 'react';

// API helper
const api = async (endpoint, options = {}) => {
  const res = await fetch(`/api/${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('API Error:', data);
    throw new Error(data.error || data.detail || `HTTP ${res.status}`);
  }
  return data;
};

// localStorage helpers
const storage = {
  getOrganizerToken: (eventId) => {
    try { return localStorage.getItem(`otterplan_org_${eventId}`); } catch { return null; }
  },
  setOrganizerToken: (eventId, token) => {
    try { localStorage.setItem(`otterplan_org_${eventId}`, token); } catch {}
  },
  getResponseId: (eventId) => {
    try { return localStorage.getItem(`otterplan_res_${eventId}`); } catch { return null; }
  },
  setResponseId: (eventId, responseId) => {
    try { localStorage.setItem(`otterplan_res_${eventId}`, responseId); } catch {}
  }
};

export default function App() {
  const [view, setView] = useState('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOrganizer, setIsOrganizer] = useState(false);

  // Event data
  const [eventId, setEventId] = useState(null);
  const [eventData, setEventData] = useState({
    title: '',
    description: '',
    candidates: [{ id: 1, datetime: '' }]
  });
  const [fixedCandidateId, setFixedCandidateId] = useState(null);
  const [venue, setVenue] = useState(null);

  // Venue input (create mode)
  const [venueEnabled, setVenueEnabled] = useState(false);
  const [venueInput, setVenueInput] = useState({
    name: '',
    address: '',
    website: '',
    imageUrl: '',
    reservationName: ''
  });

  // Responses
  const [responses, setResponses] = useState([]);
  const [responderName, setResponderName] = useState('');
  const [responderComment, setResponderComment] = useState('');
  const [answers, setAnswers] = useState({});
  const [editingResponseId, setEditingResponseId] = useState(null);
  const [myResponseId, setMyResponseId] = useState(null);

  // Venue search
  const [showVenueFinder, setShowVenueFinder] = useState(false);
  const [venueSearching, setVenueSearching] = useState(false);
  const [venueArea, setVenueArea] = useState('');
  const [venueGenre, setVenueGenre] = useState('');
  const [venueBudget, setVenueBudget] = useState('');
  const [venueResults, setVenueResults] = useState([]);
  const [selectedVenueIndex, setSelectedVenueIndex] = useState(null);

  // UI state
  const [activeTab, setActiveTab] = useState('status');
  const [copied, setCopied] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [currentUser, setCurrentUser] = useState('');

  // DM state
  const [dmTarget, setDmTarget] = useState(null);
  const [dmInput, setDmInput] = useState('');
  const [directMessages, setDirectMessages] = useState([]);
  const [showDmPanel, setShowDmPanel] = useState(false);

  // Share state
  const [showFixedShare, setShowFixedShare] = useState(false);
  const [fixedCopied, setFixedCopied] = useState(false);

  // Load event from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const org = params.get('org');

    if (id) {
      // ?org=1が付いている旧URLからのアクセス時、localStorageにトークンがなければ
      // 後方互換として主催者扱いにする（既存イベント用）
      loadEvent(id, org === '1');
    }
  }, []);

  const loadEvent = async (id, orgParam = false) => {
    setLoading(true);
    try {
      // localStorageから主催者トークンを取得してAPIに渡す
      const orgToken = storage.getOrganizerToken(id);
      const query = orgToken
        ? `events?id=${id}&organizer_token=${encodeURIComponent(orgToken)}`
        : `events?id=${id}`;
      const data = await api(query);

      setEventId(id);
      setEventData({
        title: data.title,
        description: data.description || '',
        candidates: data.candidates
      });
      setFixedCandidateId(data.fixed_candidate_id);
      setVenue(data.venue);
      setResponses(data.responses || []);
      // トークン認証 or 旧URL ?org=1 のフォールバック
      const isOrg = !!data.is_organizer || (orgParam && !orgToken);
      setIsOrganizer(isOrg);
      setView('results');

      // localStorageから自分の回答IDを復元
      const savedResponseId = storage.getResponseId(id);
      if (savedResponseId && data.responses) {
        const myResponse = data.responses.find(r => r.id === savedResponseId);
        if (myResponse) {
          setMyResponseId(savedResponseId);
          setCurrentUser(myResponse.name);
        }
      }

      // Load chat messages
      try {
        const chatData = await api(`chat?event_id=${id}`);
        setChatMessages(chatData.messages || []);
      } catch (e) {
        console.error('Chat load error:', e);
      }

      // Load DMs if organizer
      if (isOrg) {
        try {
          const dmData = await api(`dms?event_id=${id}`);
          setDirectMessages(dmData.messages || []);
        } catch (e) {
          console.error('DM load error:', e);
        }
      }
    } catch (err) {
      setError('イベントが見つかりません: ' + err.message);
    }
    setLoading(false);
  };

  // Candidates
  const addCandidate = () => {
    if (eventData.candidates.length >= 10) return;
    const newId = Math.max(...eventData.candidates.map(c => c.id)) + 1;
    setEventData(prev => ({
      ...prev,
      candidates: [...prev.candidates, { id: newId, datetime: '' }]
    }));
  };

  const removeCandidate = (id) => {
    if (eventData.candidates.length <= 1) return;
    setEventData(prev => ({
      ...prev,
      candidates: prev.candidates.filter(c => c.id !== id)
    }));
  };

  const updateCandidate = (id, value) => {
    setEventData(prev => ({
      ...prev,
      candidates: prev.candidates.map(c => c.id === id ? { ...c, datetime: value } : c)
    }));
  };

  const updateCandidatePart = (id, part, partValue) => {
    setEventData(prev => ({
      ...prev,
      candidates: prev.candidates.map(c => {
        if (c.id !== id) return c;
        const current = c.datetime || '';
        const [datePart, timePart] = current ? current.split('T') : ['', ''];
        const [hour, minute] = timePart ? timePart.split(':') : ['', ''];
        let newDate = datePart, newHour = hour || '12', newMinute = minute || '00';
        if (part === 'date') newDate = partValue;
        if (part === 'hour') newHour = partValue;
        if (part === 'minute') newMinute = partValue;
        if (!newDate) return c;
        return { ...c, datetime: `${newDate}T${newHour.padStart(2, '0')}:${newMinute.padStart(2, '0')}` };
      })
    }));
  };
  
  // Publish event
  const publishEvent = async () => {
    if (!eventData.title.trim()) {
      setError('イベント名を入力してください');
      return;
    }

    if (eventData.title.length > 255) {
      setError('イベント名は255文字以内で入力してください');
      return;
    }

    const validCandidates = eventData.candidates.filter(c => c.datetime);
    if (validCandidates.length === 0) {
      setError('候補日時を1つ以上入力してください');
      return;
    }

    setLoading(true);
    try {
      const venueData = venueEnabled && venueInput.name ? {
        name: venueInput.name,
        address: venueInput.address,
        website: venueInput.website,
        imageUrl: venueInput.imageUrl,
        reservationName: venueInput.reservationName
      } : null;

      const result = await api('events', {
        method: 'POST',
        body: {
          title: eventData.title,
          description: eventData.description,
          candidates: validCandidates,
          venue: venueData
        }
      });

      // 主催者トークンをlocalStorageに保存
      if (result.organizer_token) {
        storage.setOrganizerToken(result.id, result.organizer_token);
      }

      setEventId(result.id);
      setEventData(prev => ({ ...prev, candidates: validCandidates }));
      setVenue(venueData);
      setIsOrganizer(true);
      setView('results');

      const url = new URL(window.location);
      url.searchParams.set('id', result.id);
      url.searchParams.delete('org');
      window.history.pushState({}, '', url);
    } catch (err) {
      setError('作成エラー: ' + err.message);
    }
    setLoading(false);
  };

  // Fix/Unfix candidate
  const fixCandidate = async (candidateId) => {
    try {
      await api('events', {
        method: 'PATCH',
        body: { id: eventId, fixed_candidate_id: candidateId, organizer_token: storage.getOrganizerToken(eventId) }
      });
      setFixedCandidateId(candidateId);
      setShowFixedShare(true);
    } catch (err) {
      setError('更新エラー: ' + err.message);
    }
  };

  const unfixCandidate = async () => {
    try {
      await api('events', {
        method: 'PATCH',
        body: { id: eventId, fixed_candidate_id: null, organizer_token: storage.getOrganizerToken(eventId) }
      });
      setFixedCandidateId(null);
      setShowFixedShare(false);
    } catch (err) {
      setError('更新エラー: ' + err.message);
    }
  };

  // Submit response (new or edit)
  const submitResponse = async () => {
    if (!responderName.trim()) {
      setError('名前を入力してください');
      return;
    }

    if (responderName.length > 100) {
      setError('名前は100文字以内で入力してください');
      return;
    }

    if (Object.keys(answers).length === 0) {
      setError('1つ以上の日程に回答してください');
      return;
    }

    setLoading(true);
    try {
      if (editingResponseId) {
        // 既存回答を編集
        await api('responses', {
          method: 'PUT',
          body: {
            id: editingResponseId,
            name: responderName,
            comment: responderComment,
            answers
          }
        });
      } else {
        // 新規回答
        const result = await api('responses', {
          method: 'POST',
          body: {
            event_id: eventId,
            name: responderName,
            comment: responderComment,
            answers
          }
        });
        // 回答IDをlocalStorageに保存
        if (result.id) {
          storage.setResponseId(eventId, result.id);
          setMyResponseId(result.id);
        }
      }

      const data = await api(`events?id=${eventId}`);
      setResponses(data.responses || []);

      setCurrentUser(responderName);
      setResponderName('');
      setResponderComment('');
      setAnswers({});
      setEditingResponseId(null);
      setActiveTab('status');
    } catch (err) {
      setError('送信エラー: ' + err.message);
    }
    setLoading(false);
  };

  // 自分の回答を編集モードにする
  const startEditResponse = (response) => {
    setEditingResponseId(response.id);
    setResponderName(response.name);
    setResponderComment(response.comment || '');
    setAnswers(response.answers || {});
    setActiveTab('respond');
  };

  const cancelEdit = () => {
    setEditingResponseId(null);
    setResponderName('');
    setResponderComment('');
    setAnswers({});
  };

  // Delete event (organizer only)
  const deleteEvent = async () => {
    if (!window.confirm('このイベントを削除しますか？この操作は取り消せません。')) return;
    try {
      const orgToken = storage.getOrganizerToken(eventId);
      await api(`events?id=${eventId}&organizer_token=${encodeURIComponent(orgToken)}`, {
        method: 'DELETE'
      });
      // localStorageのクリーンアップ
      try {
        localStorage.removeItem(`otterplan_org_${eventId}`);
        localStorage.removeItem(`otterplan_res_${eventId}`);
      } catch {}
      // トップに戻る
      window.location.href = window.location.origin + window.location.pathname;
    } catch (err) {
      setError('削除エラー: ' + err.message);
    }
  };

  // Chat
  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;

    try {
      await api('chat', {
        method: 'POST',
        body: {
          event_id: eventId,
          user: isOrganizer ? 'Organizer' : currentUser,
          message: chatInput,
          isOrganizer
        }
      });

      const chatData = await api(`chat?event_id=${eventId}`);
      setChatMessages(chatData.messages || []);
      setChatInput('');
    } catch (err) {
      setError('送信エラー: ' + err.message);
    }
  };

  // DM
  const sendDm = async () => {
    if (!dmInput.trim() || !dmTarget) return;

    try {
      await api('dms', {
        method: 'POST',
        body: {
          event_id: eventId,
          from: 'Organizer',
          to: dmTarget,
          message: dmInput
        }
      });

      const dmData = await api(`dms?event_id=${eventId}`);
      setDirectMessages(dmData.messages || []);
      setDmInput('');
    } catch (err) {
      setError('送信エラー: ' + err.message);
    }
  };

  // Vote counts
  const getVoteCounts = (candidateId) => {
    const counts = { available: 0, maybe: 0, unavailable: 0 };
    responses.forEach(r => {
      const answer = r.answers?.[candidateId];
      if (answer === 'available') counts.available++;
      else if (answer === 'maybe') counts.maybe++;
      else if (answer === 'unavailable') counts.unavailable++;
    });
    return counts;
  };

  const getBestCandidateId = () => {
    let bestId = null;
    let maxAvailable = 0;
    eventData.candidates.forEach(c => {
      const counts = getVoteCounts(c.id);
      if (counts.available > maxAvailable) {
        maxAvailable = counts.available;
        bestId = c.id;
      }
    });
    return maxAvailable > 0 ? bestId : null;
  };

  // Venue search
  const searchVenues = async () => {
    if (!venueArea.trim()) {
      setError('エリアを入力してください');
      return;
    }

    setVenueSearching(true);
    setVenueResults([]);
    setSelectedVenueIndex(null);

    try {
      const fixedCandidate = eventData.candidates.find(c => c.id === fixedCandidateId);
      const result = await api('venues', {
        method: 'POST',
        body: {
          area: venueArea,
          genre: venueGenre,
          budget: venueBudget,
          fixedDateTime: fixedCandidate?.datetime
        }
      });

      setVenueResults(result.results || []);
      if (result.results?.length === 0) {
        setError('条件に合う店舗が見つかりませんでした');
      }
    } catch (err) {
      setError('検索エラー: ' + err.message);
    }
    setVenueSearching(false);
  };

  const selectVenue = async (venueData) => {
    try {
      await api('events', {
        method: 'PATCH',
        body: {
          id: eventId,
          venue: {
            name: venueData.name,
            address: venueData.address,
            rating: venueData.rating
          },
          organizer_token: storage.getOrganizerToken(eventId)
        }
      });
      setVenue(venueData);
      setShowVenueFinder(false);
      setVenueResults([]);
    } catch (err) {
      setError('会場設定エラー: ' + err.message);
    }
  };

  // Share helpers
  const formatDatetimeForShare = (datetime) => {
    if (!datetime) return '';
    const date = new Date(datetime);
    return date.toISOString().replace(/-|:|\.\d{3}/g, '');
  };

  const getFixedShareText = () => {
    const fixed = getFixedCandidate();
    if (!fixed) return '';

    const dateStr = new Date(fixed.datetime).toLocaleString('ja-JP', {
      year: 'numeric', month: 'numeric', day: 'numeric',
      weekday: 'short', hour: '2-digit', minute: '2-digit'
    });

    let text = `【確定】${eventData.title}\n日時: ${dateStr}`;

    if (venue) {
      if (venue.name) text += `\n会場: ${venue.name}`;
      if (venue.address) text += `\n住所: ${venue.address}`;
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
      line: `https://line.me/R/msg/text/?${shareText}`,
      slack: `https://slack.com/intl/ja-jp/`
    };
  };

  // Helpers
  const formatDateTime = (dt) => {
    if (!dt) return '';
    return new Date(dt).toLocaleString('ja-JP', {
      year: 'numeric', month: 'numeric', day: 'numeric',
      weekday: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDateTimeShort = (dt) => {
    if (!dt) return '';
    return new Date(dt).toLocaleString('ja-JP', {
      month: 'numeric', day: 'numeric', weekday: 'short',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  const getShareUrl = () => {
    const url = new URL(window.location);
    url.searchParams.set('id', eventId);
    url.searchParams.delete('org');
    return url.toString();
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(getShareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFixedCandidate = () => eventData.candidates.find(c => c.id === fixedCandidateId);
  const bestCandidateId = getBestCandidateId();

  // 日付制限: 今日〜3ヶ月後
  const today = new Date().toISOString().split('T')[0];
  const maxDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split('T')[0];
  })();

  // Loading screen
  if (loading && view === 'create') {
    return (
      <div style={styles.container}>
        <div style={styles.loading}><div style={styles.spinner} /> 読み込み中...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.logo}>Otterplan</div>
        <p style={styles.tagline}>シンプルな日程調整ツール</p>
      </header>

      {error && (
        <div style={styles.errorBanner}>
          {error}
          <button style={styles.errorClose} onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Create View */}
      {view === 'create' && (
        <div style={styles.card}>
          <div style={styles.cardLabel}>NEW EVENT</div>
          <h2 style={styles.cardTitle}>イベント作成</h2>

          <div style={styles.formGroup}>
            <label style={styles.label}>イベント名 *</label>
            <input
              type="text"
              style={styles.input}
              value={eventData.title}
              onChange={e => setEventData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="例：チームミーティング"
              maxLength={255}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>概要</label>
            <textarea
              style={styles.textarea}
              value={eventData.description}
              onChange={e => setEventData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="イベントの詳細..."
              rows={3}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>候補日時</label>
            <div style={styles.candidatesList}>
              {eventData.candidates.map((c, i) => (
                <div key={c.id} style={styles.candidateRow}>
                  <span style={styles.candidateNum}>{String(i + 1).padStart(2, '0')}</span>
                  <div style={styles.datetimeGroup}>
                    <input
                      type="date"
                      style={styles.dateInput}
                      value={c.datetime ? c.datetime.split('T')[0] : ''}
                      min={today}
                      max={maxDate}
                      onChange={e => updateCandidatePart(c.id, 'date', e.target.value)}
                    />
                    <select
                      style={styles.timeSelect}
                      value={c.datetime ? c.datetime.split('T')[1]?.split(':')[0] || '' : ''}
                      onChange={e => updateCandidatePart(c.id, 'hour', e.target.value)}
                    >
                      <option value="" disabled>時</option>
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={String(i).padStart(2, '0')}>{i}時</option>
                      ))}
                    </select>
                    <select
                      style={styles.timeSelect}
                      value={c.datetime ? c.datetime.split('T')[1]?.split(':')[1] || '' : ''}
                      onChange={e => updateCandidatePart(c.id, 'minute', e.target.value)}
                    >
                      <option value="" disabled>分</option>
                      {[0, 15, 30, 45].map(m => (
                        <option key={m} value={String(m).padStart(2, '0')}>{String(m).padStart(2, '0')}分</option>
                      ))}
                    </select>
                  </div>
                  <button
                    style={{ ...styles.removeBtn, opacity: eventData.candidates.length === 1 ? 0.3 : 1 }}
                    onClick={() => removeCandidate(c.id)}
                    disabled={eventData.candidates.length === 1}
                  >
                    <span style={styles.removeLine1} />
                    <span style={styles.removeLine2} />
                  </button>
                </div>
              ))}
            </div>
            {eventData.candidates.length < 10 && (
              <button style={styles.addBtn} onClick={addCandidate}>+ 候補を追加</button>
            )}
          </div>

          {/* オフライン開催（会場情報） */}
          <div style={styles.venueSection}>
            <div
              style={styles.venueToggle}
              onClick={() => setVenueEnabled(!venueEnabled)}
            >
              <div style={{
                ...styles.toggleBox,
                ...(venueEnabled ? styles.toggleBoxActive : {})
              }}>
                {venueEnabled && <span style={styles.checkMark} />}
              </div>
              <span style={styles.venueToggleLabel}>オフライン開催（会場情報を追加）</span>
            </div>

            {venueEnabled && (
              <div style={styles.venueFields}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>会場名</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={venueInput.name}
                    onChange={e => setVenueInput(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="例：会議室A"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>住所</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={venueInput.address}
                    onChange={e => setVenueInput(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="例：東京都渋谷区..."
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>会場Webサイト</label>
                  <input
                    type="url"
                    style={styles.input}
                    value={venueInput.website}
                    onChange={e => setVenueInput(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>会場画像URL</label>
                  <input
                    type="url"
                    style={styles.input}
                    value={venueInput.imageUrl}
                    onChange={e => setVenueInput(prev => ({ ...prev, imageUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>予約名義</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={venueInput.reservationName}
                    onChange={e => setVenueInput(prev => ({ ...prev, reservationName: e.target.value }))}
                    placeholder="例：山田"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            style={{ ...styles.btnPrimary, opacity: loading ? 0.5 : 1 }}
            onClick={publishEvent}
            disabled={loading}
          >
            {loading ? '作成中...' : '公開する →'}
          </button>
        </div>
      )}

      {/* Results View */}
      {view === 'results' && (
        <div style={styles.card}>
          <div style={styles.headerRow}>
            <div style={styles.cardLabel}>EVENT</div>
            {fixedCandidateId && <span style={styles.badgeFixed}>FIXED</span>}
          </div>
          <h2 style={styles.cardTitle}>{eventData.title}</h2>
          {eventData.description && <p style={styles.eventDesc}>{eventData.description}</p>}

          {/* Fixed Banner */}
          {fixedCandidateId && (
            <div style={styles.fixedBanner}>
              <div style={styles.headerRow}>
                <div style={styles.cardLabel}>CONFIRMED</div>
                {isOrganizer && (
                  <button style={styles.btnSmall} onClick={unfixCandidate}>Unfix</button>
                )}
              </div>
              <div style={styles.fixedDateTime}>{formatDateTime(getFixedCandidate()?.datetime)}</div>

              {/* Fixed Schedule Share */}
              <div style={styles.fixedShareSection}>
                <button style={styles.fixedShareToggle} onClick={() => setShowFixedShare(!showFixedShare)}>
                  {showFixedShare ? '共有オプションを閉じる' : '確定日程を共有'}
                </button>
                {showFixedShare && (
                  <div style={styles.fixedShareOptions}>
                    <div style={styles.fixedShareText}>
                      <pre style={styles.fixedSharePre}>{getFixedShareText()}</pre>
                      <button style={styles.copyBtn} onClick={copyFixedInfo}>{fixedCopied ? 'Copied!' : 'Copy'}</button>
                    </div>
                    <div style={styles.fixedShareLinks}>
                      <a href={getFixedShareLinks().google} target="_blank" rel="noopener noreferrer" style={styles.fixedShareLink}>Google Calendar</a>
                      <a href={getFixedShareLinks().mail} target="_blank" rel="noopener noreferrer" style={styles.fixedShareLink}>Mail</a>
                      <a href={getFixedShareLinks().line} target="_blank" rel="noopener noreferrer" style={styles.fixedShareLink}>LINE</a>
                      <a href={getFixedShareLinks().slack} target="_blank" rel="noopener noreferrer" style={styles.fixedShareLink}>Slack</a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Venue Finder */}
          {fixedCandidateId && !venue && isOrganizer && (
            <div style={styles.venueFinder}>
              <div style={styles.headerRow}>
                <div style={styles.cardLabel}>FIND VENUE</div>
                <button style={styles.btnSmall} onClick={() => setShowVenueFinder(!showVenueFinder)}>
                  {showVenueFinder ? '閉じる' : '会場を探す'}
                </button>
              </div>

              {!showVenueFinder && (
                <p style={styles.venueHint}>日時が確定しました。会場を検索できます。</p>
              )}

              {showVenueFinder && (
                <div style={styles.venueForm}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>エリア・最寄駅 *</label>
                    <input
                      type="text"
                      style={styles.input}
                      value={venueArea}
                      onChange={e => setVenueArea(e.target.value)}
                      placeholder="例：渋谷、新宿駅周辺"
                    />
                  </div>

                  <div style={styles.venueRow}>
                    <div style={{ ...styles.formGroup, flex: 1 }}>
                      <label style={styles.label}>ジャンル</label>
                      <select style={styles.select} value={venueGenre} onChange={e => setVenueGenre(e.target.value)}>
                        <option value="">指定なし</option>
                        <option value="izakaya">居酒屋</option>
                        <option value="japanese">和食</option>
                        <option value="italian">イタリアン</option>
                        <option value="chinese">中華</option>
                        <option value="yakiniku">焼肉</option>
                        <option value="cafe">カフェ</option>
                        <option value="bar">バー</option>
                      </select>
                    </div>
                    <div style={{ ...styles.formGroup, flex: 1 }}>
                      <label style={styles.label}>予算</label>
                      <select style={styles.select} value={venueBudget} onChange={e => setVenueBudget(e.target.value)}>
                        <option value="">指定なし</option>
                        <option value="1">〜2,000円</option>
                        <option value="2">2,000〜4,000円</option>
                        <option value="3">4,000〜6,000円</option>
                        <option value="4">6,000円〜</option>
                      </select>
                    </div>
                  </div>

                  <button
                    style={{ ...styles.btnBlue, opacity: venueSearching ? 0.5 : 1 }}
                    onClick={searchVenues}
                    disabled={venueSearching}
                  >
                    {venueSearching ? '検索中...' : 'おすすめを探す'}
                  </button>

                  {venueResults.length > 0 && (
                    <div style={styles.venueResults}>
                      <div style={styles.cardLabel}>SUGGESTIONS ({venueResults.length}件)</div>
                      {venueResults.map((v, i) => (
                        <div
                          key={v.id || i}
                          style={{
                            ...styles.venueCard,
                            ...(selectedVenueIndex === i ? styles.venueCardSelected : {})
                          }}
                          onClick={() => setSelectedVenueIndex(i)}
                        >
                          <div style={styles.venueName}>{v.name}</div>
                          <div style={styles.venueAddress}>{v.address}</div>
                          <div style={styles.venueMeta}>
                            {v.rating && <span style={styles.venueRating}>★ {v.rating}</span>}
                            {v.priceLevel && <span style={styles.venuePrice}>{'¥'.repeat(v.priceLevel)}</span>}
                          </div>

                          {selectedVenueIndex === i && (
                            <div style={styles.venueActions}>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name + ' ' + v.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={styles.btnSecondary}
                                onClick={e => e.stopPropagation()}
                              >
                                地図を見る
                              </a>
                              <button
                                style={styles.btnBlue}
                                onClick={e => { e.stopPropagation(); selectVenue(v); }}
                              >
                                この会場を設定
                              </button>
                            </div>
                          )}
                        </div>
                      ))}

                      <button style={styles.btnSecondary} onClick={searchVenues}>
                        別の候補を探す
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Venue Display */}
          {venue && (
            <div style={styles.venueDisplay}>
              <div style={styles.cardLabel}>VENUE</div>
              {venue.imageUrl && (
                <div style={styles.venueImageWrapper}>
                  <img
                    src={venue.imageUrl}
                    alt={venue.name}
                    style={styles.venueImage}
                    onError={(e) => e.target.style.display = 'none'}
                  />
                </div>
              )}
              <div style={styles.venueInfo}>
                <div style={styles.venueInfoRow}>
                  <span style={styles.venueInfoLabel}>会場名</span>
                  <span>{venue.name}</span>
                </div>
                {venue.address && (
                  <div style={styles.venueInfoRow}>
                    <span style={styles.venueInfoLabel}>住所</span>
                    <span>{venue.address}</span>
                  </div>
                )}
                {venue.reservationName && (
                  <div style={styles.venueInfoRow}>
                    <span style={styles.venueInfoLabel}>予約名義</span>
                    <span>{venue.reservationName}</span>
                  </div>
                )}
                {venue.rating && (
                  <div style={styles.venueInfoRow}>
                    <span style={styles.venueInfoLabel}>評価</span>
                    <span>★ {venue.rating}</span>
                  </div>
                )}
              </div>
              <div style={styles.venueButtons}>
                {venue.website && (
                  <a
                    href={venue.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.btnSecondary}
                  >
                    Webサイト
                  </a>
                )}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((venue.name || '') + ' ' + (venue.address || ''))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.btnSecondary}
                >
                  Google Maps
                </a>
              </div>
            </div>
          )}

          {/* Delete Event (organizer only) */}
          {isOrganizer && (
            <div style={styles.deleteSection}>
              <button style={styles.btnDanger} onClick={deleteEvent}>
                このイベントを削除
              </button>
            </div>
          )}

          {/* Share URL */}
          <div style={styles.formGroup}>
            <label style={styles.label}>招待URL</label>
            <div style={styles.urlBox}>
              <input type="text" style={styles.urlInput} value={getShareUrl()} readOnly />
              <button style={styles.copyBtn} onClick={copyUrl}>{copied ? 'Copied!' : 'Copy'}</button>
            </div>
          </div>

          {/* Tabs */}
          <div style={styles.tabs}>
            <button
              style={{ ...styles.tab, ...(activeTab === 'status' ? styles.tabActive : {}) }}
              onClick={() => setActiveTab('status')}
            >
              回答状況
            </button>
            <button
              style={{ ...styles.tab, ...(activeTab === 'respond' ? styles.tabActive : {}) }}
              onClick={() => setActiveTab('respond')}
            >
              回答する
            </button>
            <button
              style={{ ...styles.tab, ...(activeTab === 'chat' ? styles.tabActive : {}) }}
              onClick={() => setActiveTab('chat')}
            >
              Chat {chatMessages.length > 0 && `(${chatMessages.length})`}
            </button>
          </div>

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div style={styles.chatSection}>
              <div style={styles.chatMessages}>
                {chatMessages.length === 0 ? (
                  <div style={styles.chatEmpty}>メッセージはまだありません</div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} style={{ ...styles.chatMessage, ...(msg.isOrganizer ? styles.chatMessageOrganizer : {}) }}>
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
                <input
                  type="text"
                  style={styles.chatInput}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="メッセージを入力..."
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                />
                <button style={styles.chatSendBtn} onClick={sendChatMessage}>Send</button>
              </div>
            </div>
          )}

          {/* Status Tab */}
          {activeTab === 'status' && (
            <>
              <div style={styles.resultsTable}>
                <div style={isOrganizer ? styles.tableHeader : styles.tableHeaderNoAction}>
                  <div>日時</div>
                  <div style={{ textAlign: 'center' }}>○</div>
                  <div style={{ textAlign: 'center' }}>△</div>
                  <div style={{ textAlign: 'center' }}>×</div>
                  {isOrganizer && <div style={{ textAlign: 'right' }}>FIX</div>}
                </div>
                {eventData.candidates.map(c => {
                  const counts = getVoteCounts(c.id);
                  const isBest = c.id === bestCandidateId && !fixedCandidateId;
                  const isFixed = c.id === fixedCandidateId;

                  return (
                    <div key={c.id} style={{
                      ...(isOrganizer ? styles.tableRow : styles.tableRowNoAction),
                      ...(isFixed ? styles.tableRowFixed : isBest ? styles.tableRowBest : {})
                    }}>
                      <div style={styles.dateCell}>
                        {isFixed && <span style={styles.badgeFixed}>FIXED</span>}
                        {isBest && <span style={styles.badgeBest}>BEST</span>}
                        {formatDateTimeShort(c.datetime)}
                      </div>
                      <div style={{ ...styles.countCell, color: '#4ade80' }}>{counts.available}</div>
                      <div style={{ ...styles.countCell, color: '#fbbf24' }}>{counts.maybe}</div>
                      <div style={{ ...styles.countCell, color: '#f87171' }}>{counts.unavailable}</div>
                      {isOrganizer && (
                        <div style={{ textAlign: 'right' }}>
                          {isFixed ? (
                            <button style={styles.btnSmall} onClick={unfixCandidate}>Unfix</button>
                          ) : (
                            <button
                              style={styles.btnFix}
                              onClick={() => fixCandidate(c.id)}
                              disabled={fixedCandidateId !== null}
                            >
                              Fix
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Responses List */}
              {responses.length > 0 && (
                <div style={styles.responsesList}>
                  <div style={styles.cardLabel}>RESPONSES ({responses.length})</div>
                  {responses.map(r => (
                    <div key={r.id} style={{
                      ...styles.responseCard,
                      ...(r.id === myResponseId ? styles.responseCardMine : {})
                    }}>
                      <div style={styles.responseCardHeader}>
                        <div style={styles.responseName}>
                          {r.name}
                          {r.id === myResponseId && <span style={styles.myBadge}>あなた</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {r.id === myResponseId && (
                            <button style={styles.editBtn} onClick={() => startEditResponse(r)}>編集</button>
                          )}
                          {isOrganizer && (
                            <button style={styles.dmBtn} onClick={() => { setDmTarget(r.name); setShowDmPanel(true); }}>DM</button>
                          )}
                        </div>
                      </div>
                      <div style={styles.responseAnswers}>
                        {eventData.candidates.map(c => {
                          const answer = r.answers?.[c.id];
                          return (
                            <span key={c.id} style={{
                              ...styles.answerChip,
                              ...(answer === 'available' ? styles.chipGreen : {}),
                              ...(answer === 'maybe' ? styles.chipYellow : {}),
                              ...(answer === 'unavailable' ? styles.chipRed : {})
                            }}>
                              {answer === 'available' && '○'}
                              {answer === 'maybe' && '△'}
                              {answer === 'unavailable' && '×'}
                              {!answer && '-'}
                            </span>
                          );
                        })}
                      </div>
                      {r.comment && <div style={styles.responseComment}>{r.comment}</div>}
                    </div>
                  ))}
                </div>
              )}

              {responses.length === 0 && (
                <p style={styles.emptyText}>まだ回答がありません</p>
              )}
            </>
          )}

          {/* Respond Tab */}
          {activeTab === 'respond' && (
            <>
              {editingResponseId && (
                <div style={styles.editBanner}>
                  <span>回答を編集中</span>
                  <button style={styles.btnSmall} onClick={cancelEdit}>キャンセル</button>
                </div>
              )}
              <div style={styles.formGroup}>
                <label style={styles.label}>お名前 *</label>
                <input
                  type="text"
                  style={styles.input}
                  value={responderName}
                  onChange={e => setResponderName(e.target.value)}
                  placeholder="あなたの名前"
                  maxLength={100}
                />
              </div>

              <div style={styles.answerGrid}>
                {eventData.candidates.map(c => (
                  <div key={c.id} style={styles.answerRow}>
                    <div>
                      {c.id === fixedCandidateId && <span style={styles.badgeFixedSmall}>FIXED</span>}
                      {formatDateTimeShort(c.datetime)}
                    </div>
                    <div style={styles.answerBtns}>
                      <button
                        style={{ ...styles.answerBtn, ...(answers[c.id] === 'available' ? styles.answerBtnGreen : {}) }}
                        onClick={() => setAnswers(prev => ({ ...prev, [c.id]: 'available' }))}
                      >○</button>
                      <button
                        style={{ ...styles.answerBtn, ...(answers[c.id] === 'maybe' ? styles.answerBtnYellow : {}) }}
                        onClick={() => setAnswers(prev => ({ ...prev, [c.id]: 'maybe' }))}
                      >△</button>
                      <button
                        style={{ ...styles.answerBtn, ...(answers[c.id] === 'unavailable' ? styles.answerBtnRed : {}) }}
                        onClick={() => setAnswers(prev => ({ ...prev, [c.id]: 'unavailable' }))}
                      >×</button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>コメント（任意）</label>
                <textarea
                  style={styles.textarea}
                  value={responderComment}
                  onChange={e => setResponderComment(e.target.value)}
                  placeholder="コメントがあれば..."
                  rows={2}
                />
              </div>

              <button
                style={{ ...styles.btnPrimary, opacity: loading ? 0.5 : 1 }}
                onClick={submitResponse}
                disabled={loading}
              >
                {loading ? '送信中...' : editingResponseId ? '回答を更新' : '回答を送信'}
              </button>
            </>
          )}

          {/* DM Overlay */}
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
                      <input
                        type="text"
                        style={styles.chatInput}
                        value={dmInput}
                        onChange={(e) => setDmInput(e.target.value)}
                        placeholder="DMを入力..."
                        onKeyPress={(e) => e.key === 'Enter' && sendDm()}
                      />
                      <button style={styles.chatSendBtn} onClick={sendDm}>Send</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Styles
const styles = {
  container: { maxWidth: 600, margin: '0 auto', padding: '24px 16px', minHeight: '100vh' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40, color: 'rgba(255,255,255,0.5)' },
  spinner: { width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' },

  header: { textAlign: 'center', marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.1)' },
  logo: { fontSize: 11, letterSpacing: 4, color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.3)' },

  errorBanner: { padding: '12px 16px', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  errorClose: { background: 'none', border: 'none', color: '#f87171', fontSize: 18, cursor: 'pointer' },
  
  card: {},

  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: 32 },
  cardLabel: { fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', marginBottom: 8 },
  cardTitle: { fontSize: 24, fontWeight: 300, marginBottom: 24, color: '#fff' },
  eventDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24 },

  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },

  formGroup: { marginBottom: 24 },
  label: { display: 'block', fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase' },
  input: { width: '100%', padding: '14px 0', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 16, outline: 'none' },
  textarea: { width: '100%', padding: '14px 0', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 16, outline: 'none', resize: 'none', fontFamily: 'inherit' },
  select: { width: '100%', padding: 14, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 14, outline: 'none', cursor: 'pointer' },

  candidatesList: { display: 'flex', flexDirection: 'column', gap: 2, background: 'rgba(255,255,255,0.05)', marginBottom: 8 },
  candidateRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#0a0a0a' },
  candidateNum: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', width: 24 },
  datetimeInput: { flex: 1, padding: '10px 0', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none', colorScheme: 'dark' },
  datetimeGroup: { display: 'flex', flex: 1, gap: 8, alignItems: 'center' },
  dateInput: { flex: 1, padding: '10px 0', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none', colorScheme: 'dark' },
  timeSelect: { padding: '10px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 14, outline: 'none', cursor: 'pointer', colorScheme: 'dark', appearance: 'auto', WebkitAppearance: 'menulist', minWidth: 70 },
  removeBtn: { width: 28, height: 28, background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative' },
  removeLine1: { position: 'absolute', width: 14, height: 1, background: 'rgba(255,255,255,0.5)', transform: 'rotate(45deg)', top: '50%', left: '50%', marginLeft: -7, marginTop: -0.5 },
  removeLine2: { position: 'absolute', width: 14, height: 1, background: 'rgba(255,255,255,0.5)', transform: 'rotate(-45deg)', top: '50%', left: '50%', marginLeft: -7, marginTop: -0.5 },
  addBtn: { padding: 14, background: 'rgba(255,255,255,0.02)', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', width: '100%' },

  btnPrimary: { width: '100%', padding: 16, background: '#fff', border: 'none', color: '#0a0a0a', fontSize: 13, fontWeight: 500, cursor: 'pointer', letterSpacing: 1 },
  btnSecondary: { padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, cursor: 'pointer', letterSpacing: 0.5, textDecoration: 'none' },
  btnBlue: { width: '100%', padding: 14, background: '#3b82f6', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer' },
  btnSmall: { padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)', fontSize: 10, cursor: 'pointer', letterSpacing: 1 },
  btnFix: { padding: '8px 12px', background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80', fontSize: 10, cursor: 'pointer', letterSpacing: 1 },

  badgeFixed: { display: 'inline-block', padding: '3px 8px', fontSize: 9, fontWeight: 600, letterSpacing: 1, background: '#4ade80', color: '#0a0a0a', marginRight: 8 },
  badgeBest: { display: 'inline-block', padding: '3px 8px', fontSize: 9, fontWeight: 600, letterSpacing: 1, background: '#fff', color: '#0a0a0a', marginRight: 8 },
  badgeFixedSmall: { display: 'inline-block', padding: '2px 6px', fontSize: 8, fontWeight: 600, letterSpacing: 0.5, background: '#4ade80', color: '#0a0a0a', marginRight: 8 },

  fixedBanner: { padding: 20, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', marginBottom: 24 },
  fixedDateTime: { fontSize: 20, fontWeight: 500, marginTop: 12, marginBottom: 20, color: '#fff' },
  fixedShareSection: { borderTop: '1px solid rgba(74,222,128,0.2)', paddingTop: 16 },
  fixedShareToggle: { padding: '10px 16px', background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: 11, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase', width: '100%' },
  fixedShareOptions: { marginTop: 16 },
  fixedShareText: { background: 'rgba(0,0,0,0.3)', padding: 16, marginBottom: 12, display: 'flex', gap: 12, alignItems: 'flex-start' },
  fixedSharePre: { flex: 1, margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6 },
  fixedShareLinks: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  fixedShareLink: { padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, textDecoration: 'none', letterSpacing: 0.5, textTransform: 'uppercase' },

  venueFinder: { padding: 20, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: 24 },
  venueHint: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  venueForm: { marginTop: 16 },
  venueRow: { display: 'flex', gap: 16 },
  venueResults: { marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)' },
  venueCard: { padding: 16, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', marginTop: 12, cursor: 'pointer' },
  venueCardSelected: { borderColor: '#3b82f6', background: 'rgba(59,130,246,0.1)' },
  venueName: { fontSize: 15, fontWeight: 500, marginBottom: 4 },
  venueAddress: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  venueMeta: { display: 'flex', gap: 12, fontSize: 12 },
  venueRating: { color: '#fbbf24' },
  venuePrice: { color: '#4ade80' },
  venueActions: { display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' },

  venueDisplay: { padding: 20, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 24 },
  venueInfo: { marginTop: 16 },
  venueInfoRow: { display: 'flex', gap: 16, marginBottom: 8 },
  venueInfoLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 70, textTransform: 'uppercase', flexShrink: 0 },
  venueImageWrapper: { marginTop: 16, marginBottom: 16, border: '1px solid rgba(255,255,255,0.1)' },
  venueImage: { width: '100%', height: 180, objectFit: 'cover', display: 'block' },
  venueButtons: { display: 'flex', gap: 8, marginTop: 16 },

  venueSection: { marginBottom: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' },
  venueToggle: { display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 16 },
  toggleBox: { width: 20, height: 20, border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  toggleBoxActive: { background: '#fff', borderColor: '#fff' },
  checkMark: { width: 10, height: 6, borderLeft: '2px solid #0a0a0a', borderBottom: '2px solid #0a0a0a', transform: 'rotate(-45deg) translateY(-1px)' },
  venueToggleLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  venueFields: { paddingLeft: 32 },

  urlBox: { display: 'flex', gap: 1, background: 'rgba(255,255,255,0.1)' },
  urlInput: { flex: 1, padding: 14, background: 'rgba(255,255,255,0.03)', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'monospace', outline: 'none' },
  copyBtn: { padding: '14px 20px', background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', letterSpacing: 1 },

  tabs: { display: 'flex', gap: 1, background: 'rgba(255,255,255,0.1)', marginBottom: 24 },
  tab: { flex: 1, padding: 14, background: 'rgba(255,255,255,0.02)', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' },
  tabActive: { background: 'rgba(255,255,255,0.08)', color: '#fff' },

  // Chat styles
  chatSection: { border: '1px solid rgba(255,255,255,0.08)' },
  chatMessages: { height: 300, overflowY: 'auto', padding: 20 },
  chatEmpty: { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: '40px 0' },
  chatMessage: { marginBottom: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.03)' },
  chatMessageOrganizer: { borderLeft: '2px solid #fff' },
  chatMessageHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 },
  chatUser: { fontSize: 12, fontWeight: 500, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 },
  organizerBadge: { fontSize: 9, padding: '2px 6px', background: '#fff', color: '#0a0a0a', fontWeight: 600, letterSpacing: 0.5 },
  chatTime: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' },
  chatText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 },
  chatInputRow: { display: 'flex', gap: 1, borderTop: '1px solid rgba(255,255,255,0.08)' },
  chatInput: { flex: 1, padding: 16, background: 'rgba(255,255,255,0.02)', border: 'none', color: '#fff', fontSize: 14, outline: 'none' },
  chatSendBtn: { padding: '16px 24px', background: '#fff', border: 'none', color: '#0a0a0a', fontSize: 11, fontWeight: 500, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' },


  // DM styles
  dmBtn: { padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)', fontSize: 10, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' },
  dmOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  dmPanel: { width: '90%', maxWidth: 480, background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' },
  dmHeader: { padding: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  dmCloseBtn: { width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dmList: { flex: 1, overflowY: 'auto', padding: 20 },
  dmMessage: { marginBottom: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderLeft: '2px solid rgba(255,255,255,0.2)' },
  dmMessageHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 },
  dmTo: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 },
  dmText: { fontSize: 14, color: '#fff', lineHeight: 1.5 },
  dmInputSection: { padding: 20, borderTop: '1px solid rgba(255,255,255,0.08)' },
  dmTargetLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  resultsTable: { border: '1px solid rgba(255,255,255,0.08)' },
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 70px', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  tableHeaderNoAction: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 70px', padding: 16, borderTop: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' },
  tableRowNoAction: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: 16, borderTop: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' },
  tableRowBest: { background: 'rgba(255,255,255,0.05)', borderLeft: '2px solid #fff' },
  tableRowFixed: { background: 'rgba(74,222,128,0.1)', borderLeft: '2px solid #4ade80' },
  dateCell: { fontSize: 14 },
  countCell: { textAlign: 'center', fontFamily: 'monospace', fontSize: 15 },

  responsesList: { marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)' },
  responseCard: { padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  responseCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  responseName: { fontWeight: 500, marginBottom: 0 },
  responseAnswers: { display: 'flex', gap: 4 },
  answerChip: { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.3)' },
  chipGreen: { background: 'rgba(74,222,128,0.1)', color: '#4ade80' },
  chipYellow: { background: 'rgba(251,191,36,0.1)', color: '#fbbf24' },
  chipRed: { background: 'rgba(248,113,113,0.1)', color: '#f87171' },
  responseComment: { marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' },
  emptyText: { textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 40 },

  answerGrid: { marginBottom: 16 },
  answerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  answerBtns: { display: 'flex', gap: 8 },
  answerBtn: { width: 44, height: 44, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 16, cursor: 'pointer' },
  answerBtnGreen: { background: 'rgba(74,222,128,0.15)', borderColor: '#4ade80', color: '#4ade80' },
  answerBtnYellow: { background: 'rgba(251,191,36,0.15)', borderColor: '#fbbf24', color: '#fbbf24' },
  answerBtnRed: { background: 'rgba(248,113,113,0.15)', borderColor: '#f87171', color: '#f87171' },

  // Edit response styles
  responseCardMine: { borderLeft: '2px solid #3b82f6' },
  myBadge: { display: 'inline-block', padding: '2px 6px', fontSize: 9, fontWeight: 600, letterSpacing: 0.5, background: '#3b82f6', color: '#fff', marginLeft: 8 },
  editBtn: { padding: '6px 12px', background: 'transparent', border: '1px solid rgba(59,130,246,0.4)', color: '#3b82f6', fontSize: 10, cursor: 'pointer', letterSpacing: 1 },
  editBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6', fontSize: 13, marginBottom: 16 },

  // Delete styles
  deleteSection: { marginBottom: 24, textAlign: 'right' },
  btnDanger: { padding: '8px 16px', background: 'transparent', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', fontSize: 11, cursor: 'pointer', letterSpacing: 0.5 }
};
