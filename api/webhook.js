import { google } from '@googleapis/sheets';

const ZALO_ACCESS_TOKEN = process.env.ZALO_ACCESS_TOKEN;
const GOOGLE_CREDENTIALS = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');

const SHEET_ID = '1B1ImOi9U7iDtvGfr0rrRE6HA2J9XKpFUQH459tv0xxg';
const SHEET_NAME = 'DSHS';
const PHONE_COLUMN_LETTER = 'E';
const UID_COLUMN_LETTER = 'F';

export default async function handler(req, res) {
  if (req.method === 'GET' && req.query.challenge) {
    return res.status(200).send(req.query.challenge);
  }

  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const payload = req.body;

    if (payload.event === 'follow' && payload.user_id) {
      const userId = payload.user_id;
      console.log('✅ Follow - UID:', userId);

      const userInfo = await getZaloUserInfo(userId);
      if (userInfo && userInfo.phone) {
        const phone = String(userInfo.phone).replace(/\D/g, '');
        console.log('📱 Phone:', phone);
        await updateGoogleSheet(phone, userId);
      }
      return res.status(200).send('OK');
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error');
  }
}

async function getZaloUserInfo(userId) {
  const url = `https://openapi.zalo.me/v2.0/oa/user/detail?user_id=${userId}`;
  const res = await fetch(url, { headers: { access_token: ZALO_ACCESS_TOKEN } });
  const json = await res.json();
  return json.error === 0 ? json.data : null;
}

async function updateGoogleSheet(phone, uid) {
  const auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const range = `${SHEET_NAME}!${PHONE_COLUMN_LETTER}1:${UID_COLUMN_LETTER}2000`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
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
    const updateRange = `${SHEET_NAME}!${UID_COLUMN_LETTER}${rowIndex + 1}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: updateRange,
      valueInputOption: 'RAW',
      resource: { values: [[uid]] },
    });
    console.log(`✅ Cập nhật UID ${uid} cho số ${phone} tại dòng ${rowIndex + 1}`);
  } else {
    console.log(`⚠️ Không tìm thấy số ${phone} trong sheet`);
  }
}
