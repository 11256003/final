const SIRV_CLIENT_ID = "5gEKdZZMGvqMpf7ODkMjt155FOe";
// ✨ 修正了這裡！幫你補上了遺失的字元，如果還是報錯，請直接從 Discord「複製貼上」整串，不要手打以免 I/l/1 混淆
const SIRV_CLIENT_SECRET = "soAxSdlmxHMmqQIzCZiQRlPycGQ5JlAT09EX88/zABdII/muVBFDNaFP7eSouelopYuyBsiRB6Ou6Rwocap8Cw==";
async function getSirvToken(): Promise<string> {
  const response = await fetch("https://api.sirv.com/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: SIRV_CLIENT_ID, clientSecret: SIRV_CLIENT_SECRET }),
  });
  
  // ✨ 強化版錯誤攔截：如果 Token 獲取失敗，印出 Sirv 伺服器的真實拒絕原因
  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ Sirv Token 拒絕發行，原因:", errorText);
    throw new Error(`Sirv Token 取得失敗，狀態碼: ${response.status}`);
  }
  
  const data = await response.json();
  return data.token;
}

export async function uploadProfileImage(userId: string, uri: string): Promise<string> {
  try {
    console.log("🚩 [Sirv] 開始準備上傳，本地圖片 URI:", uri);
    const bearerToken = await getSirvToken();
    console.log("🚩 [Sirv] 成功取得臨時 Token");

    // 讀取圖片轉為 Blob
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const filename = `/avatars/${userId}.jpg`;
    const sirvUploadApi = `https://api.sirv.com/v2/files/upload?filename=${encodeURIComponent(filename)}`;
    
    console.log("🚩 [Sirv] 正在發送圖片二進位資料至 Sirv API...");
    const uploadRes = await fetch(sirvUploadApi, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${bearerToken}`,
        "Content-Type": "image/jpeg", // 強制指定類型，確保 Sirv 能夠正確識別
      },
      body: blob 
    });

    // ✨ 如果上傳失敗，抓出 Sirv 官方伺服器回傳的具體拒絕原因
    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      console.error("❌ Sirv 伺服器拒絕上傳，原因:", errorText);
      throw new Error(`Sirv 上傳失敗，狀態碼: ${uploadRes.status}`);
    }

    console.log("🎉 [Sirv] 圖片已成功送達 Sirv 雲端！");

    // ⚠️ 請確認你的 Sirv 帳號網域是否真的是 mychatapp，如果不是請記得改！
    const accountName = "mychatapp"; 
    const sirvUrl = `https://${accountName}.sirv.com/avatars/${userId}.jpg`;
    return `${sirvUrl}?t=${Date.now()}`;

  } catch (error) {
    // 🔥 這行會把最核心的報錯原因印出來！
    console.error("💥【Sirv 上傳流程核心錯誤】:", error);
    throw error;
  }
}