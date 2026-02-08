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

// SVG Icons (unified size)
const SvgCircle = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.5" />
  </svg>
);

const SvgTriangle = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2.5L14.5 13.5H1.5L8 2.5Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

const SvgCross = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default function App() {
  const [view, setView] = useState('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOrganizer, setIsOrganizer] = useState(false);

  // Event data
  const [eventId, setEventId] = useState(null);
  const [editingEvent, setEditingEvent] = useState(false);
  const [editEventData, setEditEventData] = useState(null);
  const [eventData, setEventData] = useState({
    title: '',
    description: '',
    candidates: [{ id: 1, datetime: '' }, { id: 2, datetime: '' }]
  });
  const [fixedCandidateId, setFixedCandidateId] = useState(null);
  const [venue, setVenue] = useState(null);

  // Password for event creation
  const [eventPassword, setEventPassword] = useState('');

  // Notification settings
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState('');
  const [notificationThreshold, setNotificationThreshold] = useState('');

  // Organizer login
  const [showOrgLogin, setShowOrgLogin] = useState(false);
  const [orgLoginPassword, setOrgLoginPassword] = useState('');
  const [orgLoginLoading, setOrgLoginLoading] = useState(false);

  // Manual modal
  const [showManual, setShowManual] = useState(false);

  // Accordion state for responses when fixed
  const [statusAccordionOpen, setStatusAccordionOpen] = useState(true);

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

  // Check if viewing detailed manual page
  const params = new URLSearchParams(window.location.search);
  const isManualPage = params.get('page') === 'manual';

  // Load event from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const org = params.get('org');

    if (id) {
      loadEvent(id, org === '1');
    }
  }, []);

  // When fixedCandidateId changes, set accordion default
  useEffect(() => {
    if (fixedCandidateId) {
      setStatusAccordionOpen(false);
    } else {
      setStatusAccordionOpen(true);
    }
  }, [fixedCandidateId]);

  const loadEvent = async (id, orgParam = false) => {
    setLoading(true);
    try {
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
      const isOrg = !!data.is_organizer || (orgParam && !orgToken);
      setIsOrganizer(isOrg);
      setView('results');

      const savedResponseId = storage.getResponseId(id);
      if (savedResponseId && data.responses) {
        const myResponse = data.responses.find(r => r.id === savedResponseId);
        if (myResponse) {
          setMyResponseId(savedResponseId);
          setCurrentUser(myResponse.name);
        }
      }

      try {
        const chatData = await api(`chat?event_id=${id}`);
        setChatMessages(chatData.messages || []);
      } catch (e) {
        console.error('Chat load error:', e);
      }

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

  // Organizer password login
  const organizerLogin = async () => {
    if (!orgLoginPassword.trim()) {
      setError('パスワードを入力してください');
      return;
    }
    setOrgLoginLoading(true);
    try {
      const result = await api('events', {
        method: 'POST',
        body: {
          action: 'login',
          id: eventId,
          password: orgLoginPassword
        }
      });
      if (result.organizer_token) {
        storage.setOrganizerToken(eventId, result.organizer_token);
        setIsOrganizer(true);
        setShowOrgLogin(false);
        setOrgLoginPassword('');
        // DM読み込み
        try {
          const dmData = await api(`dms?event_id=${eventId}`);
          setDirectMessages(dmData.messages || []);
        } catch (e) {}
      }
    } catch (err) {
      setError(err.message);
    }
    setOrgLoginLoading(false);
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
    if (eventData.candidates.length <= 2) return;
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
    if (validCandidates.length < 2) {
      setError('候補日時を2つ以上入力してください');
      return;
    }

    if (!eventPassword.trim()) {
      setError('主催者パスワードを入力してください');
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
          venue: venueData,
          password: eventPassword || undefined,
          notification_email: notificationEnabled && notificationEmail ? notificationEmail : undefined,
          notification_threshold: notificationEnabled && notificationThreshold ? parseInt(notificationThreshold, 10) : undefined
        }
      });

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
        const result = await api('responses', {
          method: 'POST',
          body: {
            event_id: eventId,
            name: responderName,
            comment: responderComment,
            answers
          }
        });
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

  // Edit event (organizer only)
  const startEditEvent = () => {
    setEditEventData({
      title: eventData.title,
      description: eventData.description,
      candidates: eventData.candidates.map(c => ({ ...c }))
    });
    setEditingEvent(true);
  };

  const cancelEditEvent = () => {
    setEditingEvent(false);
    setEditEventData(null);
  };

  const addEditCandidate = () => {
    if (editEventData.candidates.length >= 10) return;
    const newId = Math.max(...editEventData.candidates.map(c => c.id)) + 1;
    setEditEventData(prev => ({
      ...prev,
      candidates: [...prev.candidates, { id: newId, datetime: '' }]
    }));
  };

  const removeEditCandidate = (id) => {
    if (editEventData.candidates.length <= 2) return;
    setEditEventData(prev => ({
      ...prev,
      candidates: prev.candidates.filter(c => c.id !== id)
    }));
  };

  const updateEditCandidatePart = (id, part, partValue) => {
    setEditEventData(prev => ({
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

  const saveEditEvent = async () => {
    if (!editEventData.title.trim()) {
      setError('イベント名を入力してください');
      return;
    }
    const validCandidates = editEventData.candidates.filter(c => c.datetime);
    if (validCandidates.length < 2) {
      setError('候補日時を2つ以上入力してください');
      return;
    }
    setLoading(true);
    try {
      await api('events', {
        method: 'PATCH',
        body: {
          id: eventId,
          title: editEventData.title,
          description: editEventData.description,
          candidates: validCandidates,
          organizer_token: storage.getOrganizerToken(eventId)
        }
      });
      setEventData({
        title: editEventData.title,
        description: editEventData.description,
        candidates: validCandidates
      });
      setEditingEvent(false);
      setEditEventData(null);
    } catch (err) {
      setError('更新エラー: ' + err.message);
    }
    setLoading(false);
  };

  // Delete event (organizer only)
  const deleteEvent = async () => {
    if (!window.confirm('このイベントを削除しますか？この操作は取り消せません。')) return;
    try {
      const orgToken = storage.getOrganizerToken(eventId);
      await api(`events?id=${eventId}&organizer_token=${encodeURIComponent(orgToken)}`, {
        method: 'DELETE'
      });
      try {
        localStorage.removeItem(`otterplan_org_${eventId}`);
        localStorage.removeItem(`otterplan_res_${eventId}`);
      } catch {}
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
          user: isOrganizer ? '主催者' : currentUser,
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
          from: '主催者',
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

  // Whether new responses are allowed (blocked when date is fixed)
  const canSubmitNewResponse = !fixedCandidateId;
  // Whether the respond tab should be shown
  const canAccessRespondTab = canSubmitNewResponse || editingResponseId || myResponseId;

  const today = new Date().toISOString().split('T')[0];
  const maxDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split('T')[0];
  })();

  // Detailed manual page
  if (isManualPage) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.logo}>日程調整ツール</div>
          <p style={styles.tagline}>詳細マニュアル</p>
        </header>
        <div style={styles.card}>
          <h2 style={{ ...styles.cardTitle, fontSize: 18 }}>使い方ガイド</h2>

          <div style={styles.manualSection}>
            <h3 style={styles.manualHeading}>1. イベントを作成する</h3>
            <p style={styles.manualText}>
              トップページからイベント名、概要（任意）、候補日時を入力して「公開する」ボタンを押します。
              候補日時は最大10個まで追加できます。
            </p>
            <p style={styles.manualText}>
              <strong>主催者パスワード</strong>を設定すると、別のブラウザやデバイスからでも主催者としてログインできます。
              パスワードを設定しない場合、イベントを作成したブラウザでのみ主催者機能が使えます。
            </p>
          </div>

          <div style={styles.manualSection}>
            <h3 style={styles.manualHeading}>2. 参加者に共有する</h3>
            <p style={styles.manualText}>
              イベント作成後に表示される「招待URL」をコピーして、参加者に共有してください。
              URLを受け取った人は、各候補日時に対して「参加可能」「未定」「参加不可」で回答できます。
            </p>
          </div>

          <div style={styles.manualSection}>
            <h3 style={styles.manualHeading}>3. 回答する</h3>
            <p style={styles.manualText}>
              共有URLにアクセスし、「回答する」タブからお名前と各日時の回答を入力して送信します。
              送信後は「回答状況」タブで全員の回答を確認できます。
              自分の回答は後から編集することもできます。
            </p>
          </div>

          <div style={styles.manualSection}>
            <h3 style={styles.manualHeading}>4. 日時を確定する（主催者のみ）</h3>
            <p style={styles.manualText}>
              主催者は回答状況を見て、最適な日時の「確定」ボタンを押して日程を確定できます。
              確定後はGoogleカレンダー、メール、LINEなどで共有できます。
            </p>
            <p style={styles.manualText}>
              <strong>注意：</strong>日時が確定すると、新規の回答は受け付けられなくなります（既に回答済みの方の編集は可能です）。
              確定を取り消すと、再び新規回答が可能になります。
            </p>
          </div>

          <div style={styles.manualSection}>
            <h3 style={styles.manualHeading}>5. 会場を検索する（主催者のみ）</h3>
            <p style={styles.manualText}>
              日時確定後、主催者はエリアやジャンル・予算を指定して会場を検索できます。
              検索結果から会場を選択してイベントに設定できます。
            </p>
          </div>

          <div style={styles.manualSection}>
            <h3 style={styles.manualHeading}>6. チャット機能</h3>
            <p style={styles.manualText}>
              「チャット」タブで参加者同士がメッセージをやりとりできます。
              主催者は個別のダイレクトメッセージ（DM）も送信できます。
            </p>
          </div>

          <div style={styles.manualSection}>
            <h3 style={styles.manualHeading}>7. 主催者ログイン</h3>
            <p style={styles.manualText}>
              別のブラウザからアクセスした場合、イベントページの「主催者ログイン」ボタンから
              作成時に設定したパスワードでログインすると、主催者機能（日時確定、会場検索、DM、削除など）が使えるようになります。
            </p>
          </div>

          <div style={{ marginTop: 32 }}>
            <button
              style={styles.btnPrimary}
              onClick={() => window.close()}
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        <div style={styles.headerTop}>
          <div style={{ width: 32 }} />
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={styles.logo}>日程調整ツール</div>
            <p style={styles.tagline}>シンプルな日程調整ツール</p>
          </div>
          <button style={styles.helpBtn} onClick={() => setShowManual(true)}>？</button>
        </div>
      </header>

      {error && (
        <div style={styles.errorBanner}>
          {error}
          <button style={styles.errorClose} onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Manual Modal */}
      {showManual && (
        <div style={styles.modalOverlay} onClick={() => setShowManual(false)}>
          <div style={styles.modalPanel} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>使い方</span>
              <button style={styles.modalCloseBtn} onClick={() => setShowManual(false)}>×</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.manualItem}>
                <span style={styles.manualItemNum}>1</span>
                <div>
                  <div style={styles.manualItemTitle}>イベントを作成</div>
                  <div style={styles.manualItemDesc}>イベント名と候補日時を入力して公開します</div>
                </div>
              </div>
              <div style={styles.manualItem}>
                <span style={styles.manualItemNum}>2</span>
                <div>
                  <div style={styles.manualItemTitle}>URLを共有</div>
                  <div style={styles.manualItemDesc}>招待URLを参加者に送ります</div>
                </div>
              </div>
              <div style={styles.manualItem}>
                <span style={styles.manualItemNum}>3</span>
                <div>
                  <div style={styles.manualItemTitle}>回答を集める</div>
                  <div style={styles.manualItemDesc}>
                    参加者が各候補日に
                    <span style={{ display: 'inline-flex', verticalAlign: 'middle', margin: '0 2px' }}><SvgCircle size={12} color="#4ade80" /></span>
                    <span style={{ display: 'inline-flex', verticalAlign: 'middle', margin: '0 2px' }}><SvgTriangle size={12} color="#fbbf24" /></span>
                    <span style={{ display: 'inline-flex', verticalAlign: 'middle', margin: '0 2px' }}><SvgCross size={12} color="#f87171" /></span>
                    で回答します
                  </div>
                </div>
              </div>
              <div style={styles.manualItem}>
                <span style={styles.manualItemNum}>4</span>
                <div>
                  <div style={styles.manualItemTitle}>日時を確定</div>
                  <div style={styles.manualItemDesc}>主催者が最適な日時を確定します</div>
                </div>
              </div>
              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <a
                  href="?page=manual"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...styles.btnSecondary, display: 'inline-block' }}
                >
                  詳しいマニュアルを見る
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create View */}
      {view === 'create' && (
        <div style={styles.card}>
          <p style={styles.createHeading}>イベントを作成してください</p>

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
                    style={{ ...styles.removeBtn, opacity: eventData.candidates.length <= 2 ? 0.3 : 1 }}
                    onClick={() => removeCandidate(c.id)}
                    disabled={eventData.candidates.length <= 2}
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

          {/* 主催者パスワード */}
          <div style={styles.formGroup}>
            <label style={styles.label}>主催者パスワード *</label>
            <input
              type="password"
              style={styles.input}
              value={eventPassword}
              onChange={e => setEventPassword(e.target.value)}
              placeholder="主催者ログイン用パスワード"
            />
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
              別のブラウザからでも主催者としてログインできます
            </p>
          </div>

          {/* 回答数通知 */}
          <div style={styles.venueSection}>
            <div
              style={styles.venueToggle}
              onClick={() => setNotificationEnabled(!notificationEnabled)}
            >
              <div style={{
                ...styles.toggleBox,
                ...(notificationEnabled ? styles.toggleBoxActive : {})
              }}>
                {notificationEnabled && <span style={styles.checkMark} />}
              </div>
              <span style={styles.venueToggleLabel}>回答数通知（メールで通知）</span>
            </div>

            {notificationEnabled && (
              <div style={styles.venueFields}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>通知先メールアドレス</label>
                  <input
                    type="email"
                    style={styles.input}
                    value={notificationEmail}
                    onChange={e => setNotificationEmail(e.target.value)}
                    placeholder="example@mail.com"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>通知する回答数</label>
                  <select
                    style={styles.select}
                    value={notificationThreshold}
                    onChange={e => setNotificationThreshold(e.target.value)}
                  >
                    <option value="">選択してください</option>
                    {[3, 5, 10, 15, 20, 30].map(n => (
                      <option key={n} value={n}>{n}件</option>
                    ))}
                  </select>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                    回答数が指定件数に達したらメールで通知します
                  </p>
                </div>
              </div>
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
            {loading ? '作成中...' : '公開する'}
          </button>
        </div>
      )}

      {/* Results View */}
      {view === 'results' && (
        <div style={styles.card}>
          <div style={styles.headerRow}>
            <div style={styles.cardLabel}>イベント</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {fixedCandidateId && <span style={styles.badgeFixed}>確定</span>}
              {isOrganizer && !editingEvent && (
                <button style={styles.editBtn} onClick={startEditEvent}>編集</button>
              )}
              {!isOrganizer && (
                <button style={styles.orgLoginBtn} onClick={() => setShowOrgLogin(true)}>
                  主催者ログイン
                </button>
              )}
            </div>
          </div>

          {editingEvent && editEventData ? (
            <div style={{ marginBottom: 24 }}>
              <div style={styles.editBanner}>
                <span>イベントを編集中</span>
                <button style={styles.btnSmall} onClick={cancelEditEvent}>キャンセル</button>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>イベント名 *</label>
                <input
                  type="text"
                  style={styles.input}
                  value={editEventData.title}
                  onChange={e => setEditEventData(prev => ({ ...prev, title: e.target.value }))}
                  maxLength={255}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>概要</label>
                <textarea
                  style={styles.textarea}
                  value={editEventData.description}
                  onChange={e => setEditEventData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>候補日時</label>
                <div style={styles.candidatesList}>
                  {editEventData.candidates.map((c, i) => (
                    <div key={c.id} style={styles.candidateRow}>
                      <span style={styles.candidateNum}>{String(i + 1).padStart(2, '0')}</span>
                      <div style={styles.datetimeGroup}>
                        <input
                          type="date"
                          style={styles.dateInput}
                          value={c.datetime ? c.datetime.split('T')[0] : ''}
                          onChange={e => updateEditCandidatePart(c.id, 'date', e.target.value)}
                        />
                        <select
                          style={styles.timeSelect}
                          value={c.datetime ? c.datetime.split('T')[1]?.split(':')[0] || '' : ''}
                          onChange={e => updateEditCandidatePart(c.id, 'hour', e.target.value)}
                        >
                          <option value="" disabled>時</option>
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={String(i).padStart(2, '0')}>{i}時</option>
                          ))}
                        </select>
                        <select
                          style={styles.timeSelect}
                          value={c.datetime ? c.datetime.split('T')[1]?.split(':')[1] || '' : ''}
                          onChange={e => updateEditCandidatePart(c.id, 'minute', e.target.value)}
                        >
                          <option value="" disabled>分</option>
                          {[0, 15, 30, 45].map(m => (
                            <option key={m} value={String(m).padStart(2, '0')}>{String(m).padStart(2, '0')}分</option>
                          ))}
                        </select>
                      </div>
                      <button
                        style={{ ...styles.removeBtn, opacity: editEventData.candidates.length <= 2 ? 0.3 : 1 }}
                        onClick={() => removeEditCandidate(c.id)}
                        disabled={editEventData.candidates.length <= 2}
                      >
                        <span style={styles.removeLine1} />
                        <span style={styles.removeLine2} />
                      </button>
                    </div>
                  ))}
                </div>
                {editEventData.candidates.length < 10 && (
                  <button style={styles.addBtn} onClick={addEditCandidate}>+ 候補を追加</button>
                )}
              </div>
              <button
                style={{ ...styles.btnPrimary, opacity: loading ? 0.5 : 1 }}
                onClick={saveEditEvent}
                disabled={loading}
              >
                {loading ? '保存中...' : '変更を保存'}
              </button>
            </div>
          ) : (
            <>
              <h2 style={styles.cardTitle}>{eventData.title}</h2>
              {eventData.description && <p style={styles.eventDesc}>{eventData.description}</p>}
            </>
          )}

          {/* Organizer Login Modal */}
          {showOrgLogin && (
            <div style={styles.modalOverlay} onClick={() => setShowOrgLogin(false)}>
              <div style={styles.modalPanel} onClick={(e) => e.stopPropagation()}>
                <div style={styles.modalHeader}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>主催者ログイン</span>
                  <button style={styles.modalCloseBtn} onClick={() => setShowOrgLogin(false)}>×</button>
                </div>
                <div style={styles.modalBody}>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
                    イベント作成時に設定したパスワードを入力してください
                  </p>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>パスワード</label>
                    <input
                      type="password"
                      style={styles.input}
                      value={orgLoginPassword}
                      onChange={e => setOrgLoginPassword(e.target.value)}
                      placeholder="パスワードを入力"
                      onKeyPress={(e) => e.key === 'Enter' && organizerLogin()}
                    />
                  </div>
                  <button
                    style={{ ...styles.btnPrimary, opacity: orgLoginLoading ? 0.5 : 1 }}
                    onClick={organizerLogin}
                    disabled={orgLoginLoading}
                  >
                    {orgLoginLoading ? 'ログイン中...' : 'ログイン'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Fixed Banner */}
          {fixedCandidateId && (
            <div style={styles.fixedBanner}>
              <div style={styles.headerRow}>
                <div style={styles.cardLabel}>確定日時</div>
                {isOrganizer && (
                  <button style={styles.btnSmall} onClick={unfixCandidate}>確定を取消</button>
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
                      <button style={styles.copyBtn} onClick={copyFixedInfo}>{fixedCopied ? 'コピー済み' : 'コピー'}</button>
                    </div>
                    <div style={styles.fixedShareLinks}>
                      <a href={getFixedShareLinks().google} target="_blank" rel="noopener noreferrer" style={styles.fixedShareLink}>Googleカレンダー</a>
                      <a href={getFixedShareLinks().mail} target="_blank" rel="noopener noreferrer" style={styles.fixedShareLink}>メール</a>
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
                <div style={styles.cardLabel}>会場検索</div>
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
                      <div style={styles.cardLabel}>検索結果（{venueResults.length}件）</div>
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
              <div style={styles.cardLabel}>会場情報</div>
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
                {venue.address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((venue.name || '') + ' ' + venue.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.btnSecondary}
                  >
                    地図で見る
                  </a>
                )}
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
              <button style={styles.copyBtn} onClick={copyUrl}>{copied ? 'コピー済み' : 'コピー'}</button>
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
            {canAccessRespondTab ? (
              <button
                style={{ ...styles.tab, ...(activeTab === 'respond' ? styles.tabActive : {}) }}
                onClick={() => {
                  if (fixedCandidateId && !editingResponseId && myResponseId) {
                    // 確定済みの場合は自分の回答の編集モードで開く
                    const myResp = responses.find(r => r.id === myResponseId);
                    if (myResp) startEditResponse(myResp);
                  } else {
                    setActiveTab('respond');
                  }
                }}
              >
                {fixedCandidateId ? '回答を編集' : '回答する'}
              </button>
            ) : (
              <div style={{ ...styles.tab, color: 'rgba(255,255,255,0.2)', cursor: 'default', flex: 1, padding: 14, fontSize: 12 }}>
                回答締切
              </div>
            )}
            <button
              style={{ ...styles.tab, ...(activeTab === 'chat' ? styles.tabActive : {}) }}
              onClick={() => setActiveTab('chat')}
            >
              チャット {chatMessages.length > 0 && `(${chatMessages.length})`}
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
                          {msg.isOrganizer && <span style={styles.organizerBadge}>主催者</span>}
                        </span>
                        <span style={styles.chatTime}>{formatTime(msg.createdAt)}</span>
                      </div>
                      <div style={styles.chatText}>{msg.message}</div>
                    </div>
                  ))
                )}
              </div>
              {!isOrganizer && !currentUser && (
                <div style={{ marginBottom: 8 }}>
                  <input
                    type="text"
                    style={styles.chatInput}
                    value={chatInput}
                    onChange={() => {}}
                    placeholder="チャットするには名前を入力してください"
                    readOnly
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input
                      type="text"
                      style={{ ...styles.chatInput, flex: 1 }}
                      value={responderName}
                      onChange={(e) => setResponderName(e.target.value)}
                      placeholder="あなたの名前"
                      maxLength={100}
                    />
                    <button
                      style={styles.chatSendBtn}
                      onClick={() => {
                        if (responderName.trim()) setCurrentUser(responderName.trim());
                      }}
                    >
                      設定
                    </button>
                  </div>
                </div>
              )}
              {(isOrganizer || currentUser) && (
                <div style={styles.chatInputRow}>
                  <input
                    type="text"
                    style={styles.chatInput}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="メッセージを入力..."
                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  />
                  <button style={styles.chatSendBtn} onClick={sendChatMessage}>送信</button>
                </div>
              )}
            </div>
          )}

          {/* Status Tab */}
          {activeTab === 'status' && (
            <>
              {/* Accordion wrapper when fixed */}
              {fixedCandidateId && (
                <button
                  style={styles.accordionToggle}
                  onClick={() => setStatusAccordionOpen(!statusAccordionOpen)}
                >
                  <span>回答状況を{statusAccordionOpen ? '閉じる' : '表示する'}</span>
                  <span style={{ transform: statusAccordionOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                </button>
              )}

              {(!fixedCandidateId || statusAccordionOpen) && (
                <>
                  <div style={styles.resultsTable}>
                    <div style={isOrganizer ? styles.tableHeader : styles.tableHeaderNoAction}>
                      <div>日時</div>
                      <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center' }}><SvgCircle size={14} color="rgba(255,255,255,0.4)" /></div>
                      <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center' }}><SvgTriangle size={14} color="rgba(255,255,255,0.4)" /></div>
                      <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center' }}><SvgCross size={14} color="rgba(255,255,255,0.4)" /></div>
                      {isOrganizer && <div style={{ textAlign: 'right' }}>確定</div>}
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
                            {isFixed && <span style={styles.badgeFixed}>確定</span>}
                            {isBest && <span style={styles.badgeBest}>最有力</span>}
                            {formatDateTimeShort(c.datetime)}
                          </div>
                          <div style={{ ...styles.countCell, color: '#4ade80' }}>{counts.available}</div>
                          <div style={{ ...styles.countCell, color: '#fbbf24' }}>{counts.maybe}</div>
                          <div style={{ ...styles.countCell, color: '#f87171' }}>{counts.unavailable}</div>
                          {isOrganizer && (
                            <div style={{ textAlign: 'right' }}>
                              {isFixed ? (
                                <button style={styles.btnSmall} onClick={unfixCandidate}>取消</button>
                              ) : (
                                <button
                                  style={styles.btnFix}
                                  onClick={() => fixCandidate(c.id)}
                                  disabled={fixedCandidateId !== null}
                                >
                                  確定
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
                      <div style={styles.cardLabel}>回答一覧（{responses.length}件）</div>
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
                                  {answer === 'available' && <SvgCircle size={14} color="#4ade80" />}
                                  {answer === 'maybe' && <SvgTriangle size={14} color="#fbbf24" />}
                                  {answer === 'unavailable' && <SvgCross size={14} color="#f87171" />}
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
            </>
          )}

          {/* Respond Tab */}
          {activeTab === 'respond' && (
            <>
              {/* 確定済みで新規回答不可の場合のメッセージ */}
              {fixedCandidateId && !editingResponseId && !myResponseId && (
                <div style={styles.fixedNoticeBanner}>
                  <p>日時が確定済みのため、新規回答は受け付けていません。</p>
                </div>
              )}

              {/* 確定済みで自分の回答がある場合の編集案内 */}
              {fixedCandidateId && !editingResponseId && myResponseId && (
                <div style={styles.editBanner}>
                  <span>日時確定済み。回答の編集のみ可能です。</span>
                  <button style={styles.btnSmall} onClick={() => {
                    const myResp = responses.find(r => r.id === myResponseId);
                    if (myResp) startEditResponse(myResp);
                  }}>回答を編集</button>
                </div>
              )}

              {/* Show form only when allowed */}
              {(!fixedCandidateId || editingResponseId) && (
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
                          {c.id === fixedCandidateId && <span style={styles.badgeFixedSmall}>確定</span>}
                          {formatDateTimeShort(c.datetime)}
                        </div>
                        <div style={styles.answerBtns}>
                          <button
                            style={{ ...styles.answerBtn, ...(answers[c.id] === 'available' ? styles.answerBtnGreen : {}) }}
                            onClick={() => setAnswers(prev => ({ ...prev, [c.id]: 'available' }))}
                          ><SvgCircle size={18} /></button>
                          <button
                            style={{ ...styles.answerBtn, ...(answers[c.id] === 'maybe' ? styles.answerBtnYellow : {}) }}
                            onClick={() => setAnswers(prev => ({ ...prev, [c.id]: 'maybe' }))}
                          ><SvgTriangle size={18} /></button>
                          <button
                            style={{ ...styles.answerBtn, ...(answers[c.id] === 'unavailable' ? styles.answerBtnRed : {}) }}
                            onClick={() => setAnswers(prev => ({ ...prev, [c.id]: 'unavailable' }))}
                          ><SvgCross size={18} /></button>
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
            </>
          )}

          {/* DM Overlay */}
          {showDmPanel && (
            <div style={styles.modalOverlay} onClick={() => setShowDmPanel(false)}>
              <div style={styles.modalPanel} onClick={(e) => e.stopPropagation()}>
                <div style={styles.modalHeader}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>ダイレクトメッセージ</span>
                  <button style={styles.modalCloseBtn} onClick={() => setShowDmPanel(false)}>×</button>
                </div>
                <div style={styles.dmList}>
                  {directMessages.filter(dm => dm.to === dmTarget).map((dm) => (
                    <div key={dm.id} style={styles.dmMessage}>
                      <div style={styles.dmMessageHeader}>
                        <span style={styles.dmTo}>宛先: {dm.to}</span>
                        <span style={styles.chatTime}>{formatTime(dm.createdAt)}</span>
                      </div>
                      <div style={styles.dmText}>{dm.message}</div>
                    </div>
                  ))}
                </div>
                {dmTarget && (
                  <div style={styles.dmInputSection}>
                    <div style={styles.dmTargetLabel}>宛先: {dmTarget}</div>
                    <div style={styles.chatInputRow}>
                      <input
                        type="text"
                        style={styles.chatInput}
                        value={dmInput}
                        onChange={(e) => setDmInput(e.target.value)}
                        placeholder="DMを入力..."
                        onKeyPress={(e) => e.key === 'Enter' && sendDm()}
                      />
                      <button style={styles.chatSendBtn} onClick={sendDm}>送信</button>
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
  headerTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo: { fontSize: 11, letterSpacing: 4, color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.3)' },
  helpBtn: { width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  errorBanner: { padding: '12px 16px', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  errorClose: { background: 'none', border: 'none', color: '#f87171', fontSize: 18, cursor: 'pointer' },

  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: 32 },
  cardLabel: { fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', marginBottom: 8 },
  cardTitle: { fontSize: 24, fontWeight: 300, marginBottom: 24, color: '#fff' },
  createHeading: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 24 },
  eventDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24 },

  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },

  formGroup: { marginBottom: 24 },
  label: { display: 'block', fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
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

  orgLoginBtn: { padding: '4px 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)', fontSize: 9, cursor: 'pointer', letterSpacing: 0.5 },

  badgeFixed: { display: 'inline-block', padding: '3px 8px', fontSize: 9, fontWeight: 600, letterSpacing: 1, background: '#4ade80', color: '#0a0a0a', marginRight: 8 },
  badgeBest: { display: 'inline-block', padding: '3px 8px', fontSize: 9, fontWeight: 600, letterSpacing: 1, background: '#fff', color: '#0a0a0a', marginRight: 8 },
  badgeFixedSmall: { display: 'inline-block', padding: '2px 6px', fontSize: 8, fontWeight: 600, letterSpacing: 0.5, background: '#4ade80', color: '#0a0a0a', marginRight: 8 },

  fixedBanner: { padding: 20, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', marginBottom: 24 },
  fixedDateTime: { fontSize: 20, fontWeight: 500, marginTop: 12, marginBottom: 20, color: '#fff' },
  fixedShareSection: { borderTop: '1px solid rgba(74,222,128,0.2)', paddingTop: 16 },
  fixedShareToggle: { padding: '10px 16px', background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: 11, cursor: 'pointer', letterSpacing: 1, width: '100%' },
  fixedShareOptions: { marginTop: 16 },
  fixedShareText: { background: 'rgba(0,0,0,0.3)', padding: 16, marginBottom: 12, display: 'flex', gap: 12, alignItems: 'flex-start' },
  fixedSharePre: { flex: 1, margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6 },
  fixedShareLinks: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  fixedShareLink: { padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, textDecoration: 'none', letterSpacing: 0.5 },

  fixedNoticeBanner: { padding: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 16, textAlign: 'center' },

  accordionToggle: { width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },

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
  venueInfoLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 70, flexShrink: 0 },
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
  chatSendBtn: { padding: '16px 24px', background: '#fff', border: 'none', color: '#0a0a0a', fontSize: 11, fontWeight: 500, cursor: 'pointer', letterSpacing: 1 },

  // DM styles
  dmBtn: { padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)', fontSize: 10, cursor: 'pointer', letterSpacing: 1 },
  dmList: { flex: 1, overflowY: 'auto', padding: 20 },
  dmMessage: { marginBottom: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderLeft: '2px solid rgba(255,255,255,0.2)' },
  dmMessageHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 },
  dmTo: { fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 },
  dmText: { fontSize: 14, color: '#fff', lineHeight: 1.5 },
  dmInputSection: { padding: 20, borderTop: '1px solid rgba(255,255,255,0.08)' },
  dmTargetLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 12, letterSpacing: 0.5 },

  // Modal styles (shared by manual, org login, DM)
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalPanel: { width: '90%', maxWidth: 480, background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' },
  modalHeader: { padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalCloseBtn: { width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 20, overflowY: 'auto' },

  // Manual modal content
  manualItem: { display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-start' },
  manualItemNum: { width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  manualItemTitle: { fontSize: 13, fontWeight: 500, color: '#fff', marginBottom: 2 },
  manualItemDesc: { fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 },

  // Detailed manual page styles
  manualSection: { marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' },
  manualHeading: { fontSize: 15, fontWeight: 500, color: '#fff', marginBottom: 8 },
  manualText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, marginBottom: 8 },

  resultsTable: { border: '1px solid rgba(255,255,255,0.08)' },
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 70px', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, alignItems: 'center' },
  tableHeaderNoAction: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, alignItems: 'center' },
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
  answerBtn: { width: 44, height: 44, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  answerBtnGreen: { background: 'rgba(74,222,128,0.15)', borderColor: '#4ade80', color: '#4ade80' },
  answerBtnYellow: { background: 'rgba(251,191,36,0.15)', borderColor: '#fbbf24', color: '#fbbf24' },
  answerBtnRed: { background: 'rgba(248,113,113,0.15)', borderColor: '#f87171', color: '#f87171' },

  // Edit response styles
  responseCardMine: {},
  myBadge: { display: 'inline-block', padding: '2px 6px', fontSize: 9, fontWeight: 600, letterSpacing: 0.5, background: '#3b82f6', color: '#fff', marginLeft: 8 },
  editBtn: { padding: '6px 12px', background: 'transparent', border: '1px solid rgba(59,130,246,0.4)', color: '#3b82f6', fontSize: 10, cursor: 'pointer', letterSpacing: 1 },
  editBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6', fontSize: 13, marginBottom: 16 },

  // Delete styles
  deleteSection: { marginBottom: 24, textAlign: 'right' },
  btnDanger: { padding: '8px 16px', background: 'transparent', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', fontSize: 11, cursor: 'pointer', letterSpacing: 0.5 }
};
