// 会場検索 - Google Places API (New)
export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { area, genre, budget, fixedDateTime } = JSON.parse(event.body);

    if (!area) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'area required' }) };
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    // APIキーがない場合はモックデータを返す
    if (!apiKey) {
      const mockResults = generateMockResults(area, genre);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ results: mockResults })
      };
    }

    // ジャンルマッピング
    const genreMap = {
      'izakaya': '居酒屋',
      'japanese': '和食',
      'italian': 'イタリアン',
      'french': 'フレンチ',
      'chinese': '中華料理',
      'korean': '韓国料理',
      'yakiniku': '焼肉',
      'sushi': '寿司',
      'cafe': 'カフェ',
      'bar': 'バー'
    };
    
    const genreLabel = genreMap[genre] || 'レストラン';
    const searchQuery = `${area} ${genreLabel}`;

    // Google Places API (New) - Text Search
    const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
    
    const requestBody = {
      textQuery: searchQuery,
      languageCode: 'ja',
      maxResultCount: 20,
      includedType: 'restaurant'
    };

    // 予算フィルター
    const priceLevelMap = {
      '1': ['PRICE_LEVEL_INEXPENSIVE'],
      '2': ['PRICE_LEVEL_MODERATE'],
      '3': ['PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_EXPENSIVE'],
      '4': ['PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE']
    };

    if (budget && priceLevelMap[budget]) {
      requestBody.priceLevels = priceLevelMap[budget];
    }

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.error('Places API error:', await response.text());
      // APIエラー時はモックデータを返す
      const mockResults = generateMockResults(area, genre);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ results: mockResults })
      };
    }

    const data = await response.json();

    if (!data.places || data.places.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ results: [] })
      };
    }

    // ランダムに5件選択
    const shuffled = data.places.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 5);

    // 結果を整形
    const priceLevelNum = {
      'PRICE_LEVEL_FREE': 0,
      'PRICE_LEVEL_INEXPENSIVE': 1,
      'PRICE_LEVEL_MODERATE': 2,
      'PRICE_LEVEL_EXPENSIVE': 3,
      'PRICE_LEVEL_VERY_EXPENSIVE': 4
    };

    const results = selected.map(place => ({
      id: place.id,
      name: place.displayName?.text || '',
      address: place.formattedAddress || '',
      rating: place.rating || null,
      userRatingsTotal: place.userRatingCount || null,
      priceLevel: priceLevelNum[place.priceLevel] || null,
      openNow: place.currentOpeningHours?.openNow ?? null
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ results })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

// モックデータ生成
function generateMockResults(area, genre) {
  const genreMap = {
    'izakaya': '居酒屋',
    'japanese': '和食',
    'italian': 'イタリアン',
    'chinese': '中華',
    'yakiniku': '焼肉',
    'cafe': 'カフェ',
    'bar': 'バー'
  };
  
  const genreLabel = genreMap[genre] || 'レストラン';
  
  const mockPlaces = [
    { suffix: '本店', rating: 4.5, reviews: 328, price: 3 },
    { suffix: '別館', rating: 4.2, reviews: 156, price: 2 },
    { suffix: 'ダイニング', rating: 4.7, reviews: 89, price: 4 },
    { suffix: 'キッチン', rating: 4.0, reviews: 245, price: 2 },
    { suffix: '食堂', rating: 4.3, reviews: 412, price: 1 }
  ];

  const count = 3 + Math.floor(Math.random() * 3);
  
  return mockPlaces.slice(0, count).map((place, i) => ({
    id: `mock_${i}_${Date.now()}`,
    name: `${area}${genreLabel}${place.suffix}`,
    address: `東京都${area}区○○ ${i + 1}-${i + 2}-${i + 3}`,
    rating: place.rating,
    userRatingsTotal: place.reviews,
    priceLevel: place.price,
    openNow: true
  }));
}
