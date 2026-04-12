import { google } from '@googleapis/sheets';

const ZALO_ACCESS_TOKEN = process.env.ZALO_ACCESS_TOKEN;
const GOOGLE_CREDENTIALS = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');

const SHEET_ID = '1B1ImOi9U7iDtvGfr0rrRE6HA2J9XKpFUQH459tv0xxg';           // Ví dụ: 1aBcD...xyz
const SHEET_NAME = 'DSHS';               // Tên sheet
const PHONE_COLUMN = 'E';                                 // Cột chứa số điện thoại
const UID_COLUMN = 'F';                                   // Cột muốn điền UID

export default async function handler(req, res) {
  // Xử lý verification của Zalo
  if (req.method === 'GET' && req.query.challenge) {
    return res.status(200).send(req.query.challenge);
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const payload = req.body;

    if (payload.event === 'follow' && payload.user_id) {
      const userId = payload.user_id;
      console.log('✅ Follow event - UID:', userId);

      // Lấy thông tin user (có số điện thoại)
      const userInfo = await getZaloUserInfo(userId);
      
      if (userInfo && userInfo.phone) {
        const phone = String(userInfo.phone).replace(/\D/g, '');
        console.log('📱 Số điện thoại:', phone);

        // Tìm và cập nhật Google Sheet
        await updateGoogleSheet(phone, userId);
      }

      return res.status(200).send('OK');
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).send('Error');
  }
}

async function getZaloUserInfo(userId) {
  const url = `https://openapi.zalo.me/v2.0/oa/user/detail?user_id=${userId}`;
  const response = await fetch(url, {
    headers: { 'access_token': ZALO_ACCESS_TOKEN }
  });
  const json = await response.json();
  return json.error === 0 ? json.data : null;
}

async function updateGoogleSheet(phone, uid) {
  const auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Lấy toàn bộ dữ liệu sheet
  const range = `${SHEET_NAME}!${PHONE_COLUMN}1:${UID_COLUMN}1000`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: range,
  });

  const rows = response.data.values || [];
  let rowIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    const cellPhone = String(rows[i][0] || '').replace(/\D/g, '');
    if (cellPhone === phone) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex !== -1) {
    const updateRange = `${SHEET_NAME}!${UID_COLUMN}${rowIndex + 1}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: updateRange,
      valueInputOption: 'RAW',
      resource: { values: [[uid]] },
    });
    console.log(`✅ Đã cập nhật UID ${uid} cho số ${phone} tại dòng ${rowIndex + 1}`);
  } else {
    console.log(`⚠️ Không tìm thấy số điện thoại ${phone} trong sheet`);
  }
}
