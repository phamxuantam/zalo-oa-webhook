export default async function handler(req, res) {
  console.log('=== NHẬN REQUEST TỪ ZALO ===');
  console.log('Body đầy đủ:', JSON.stringify(req.body, null, 2));

  if (req.query?.challenge || req.body?.challenge) {
    const challenge = req.query?.challenge || req.body.challenge;
    console.log('✅ Xử lý challenge OK');
    return res.status(200).send(challenge);
  }

  if (req.method === 'POST' && req.body?.event_name === 'follow' && req.body?.follower?.id) {
    const userId = req.body.follower.id;
    console.log('✅ ĐÃ NHẬN FOLLOW - UID:', userId);

    const userInfo = await getZaloUserInfo(userId);
    
    if (userInfo) {
      console.log('📋 UserInfo đầy đủ từ Zalo:', JSON.stringify(userInfo, null, 2));
      
      if (userInfo.phone) {
        let phone = String(userInfo.phone).replace(/\D/g, '');
        if (phone.startsWith('84')) phone = phone.substring(2);
        if (phone.startsWith('0')) phone = phone.substring(1);
        console.log('📱 Phone sau khi làm sạch:', phone);
        await updateGoogleSheet(phone, userId);
      } else {
        console.log('⚠️ UserInfo KHÔNG CÓ PHONE (người dùng chưa cấp quyền xem số điện thoại)');
      }
    } else {
      console.log('⚠️ Không lấy được userInfo từ Zalo');
    }
  }

  return res.status(200).send('OK');
}

async function getZaloUserInfo(userId) {
  const url = `https://openapi.zalo.me/v2.0/oa/user/detail?user_id=${userId}`;
  const res = await fetch(url, { headers: { access_token: process.env.ZALO_ACCESS_TOKEN } });
  const json = await res.json();
  console.log('Raw UserInfo JSON:', JSON.stringify(json, null, 2));
  return json.error === 0 ? json.data : null;
}

async function updateGoogleSheet(phone, uid) {
  const { google } = await import('@googleapis/sheets');
  const GOOGLE_CREDENTIALS = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');

  const auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const range = `DSHS!E1:F2000`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: '1B1ImOi9U7iDtvGfr0rrRE6HA2J9XKpFUQH459tv0xxg',
    range,
  });

  const rows = response.data.values || [];
  console.log(`📊 Sheet có ${rows.length} dòng dữ liệu`);

  let rowIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    let cellPhone = String(rows[i][0] || '').replace(/\D/g, '');
    if (cellPhone.startsWith('84')) cellPhone = cellPhone.substring(2);
    if (cellPhone.startsWith('0')) cellPhone = cellPhone.substring(1);
    
    console.log(`Dòng ${i+1}: Phone trong Sheet sau làm sạch = ${cellPhone}`);
    
    if (cellPhone === phone) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex !== -1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: '1B1ImOi9U7iDtvGfr0rrRE6HA2J9XKpFUQH459tv0xxg',
      range: `DSHS!F${rowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: { values: [[uid]] },
    });
    console.log(`🎉 ĐÃ CẬP NHẬT UID ${uid} VÀO CỘT F - DÒNG ${rowIndex + 1}`);
  } else {
    console.log(`⚠️ KHÔNG TÌM THẤY số điện thoại ${phone} trong cột E`);
  }
}
