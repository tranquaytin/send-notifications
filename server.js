const admin = require('firebase-admin');

// Khởi tạo Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

console.log('Server is running and listening for reminders...');

// Hàm gửi thông báo qua Expo
async function sendPushNotification(expoPushToken, message) {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: expoPushToken,
      sound: 'default',
      title: 'Thông báo từ Love Plant',
      body: message,
    }),
  });

  const data = await response.json();
  console.log(data);
}

// Hàm kiểm tra reminders và gửi thông báo nếu đến giờ
async function checkAndSendNotifications() {
  const now = new Date();
  console.log(`Current time: ${now.toISOString()}`); // In ra thời gian hiện tại

  try {
    const snapshot = await db.collection('reminders').get();

    snapshot.forEach(async (doc) => {
      const reminderData = doc.data();
      const reminderTime = new Date(reminderData.reminderTime);
      const userId = reminderData.userId;

      console.log(`Reminder for user: ${userId}, reminderTime: ${reminderTime.toISOString()}`);

      const timeDifference = Math.abs(reminderTime - now);

      // Kiểm tra nếu reminderTime chính xác hoặc gần đúng trong khoảng 2 giây tới
      if (timeDifference <= 1000 && !reminderData.notified) {  // Khoảng 2 giây
        // Lấy pushToken từ người dùng trong collection USERS
        const userDoc = await db.collection('USERS').doc(userId).get();

        // In ra dữ liệu người dùng
        if (userDoc.exists) {
          const userData = userDoc.data();
          const expoPushToken = userData.pushToken;
          console.log(`Push token for user ${userId}: ${expoPushToken}`);

          if (expoPushToken) {
            await sendPushNotification(expoPushToken, 'Đã đến giờ tưới cho cây!');
            console.log(`Đã gửi thông báo cho user: ${userId}`);

            // Đánh dấu đã gửi thông báo
            await db.collection('reminders').doc(doc.id).update({ notified: true });
          } else {
            console.log(`Không tìm thấy pushToken cho user: ${userId}`);
          }
        } else {
          console.log(`Không tìm thấy thông tin người dùng cho userId: ${userId}`);
        }
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu từ Firestore: ', error);
  }
}


// Thiết lập để kiểm tra reminders mỗi phút
setInterval(checkAndSendNotifications, 15000);
