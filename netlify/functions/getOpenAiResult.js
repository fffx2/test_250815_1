// 파일 위치: netlify/functions/getOpenAiResult.js

exports.handler = async function(event, context) {
  // 1. Netlify에 저장된 비밀 API 키를 안전하게 불러옵니다.
  const openAiApiKey = process.env.OPENAI_API_KEY;

  // 2. 웹사이트에서 사용자가 보낸 질문(prompt)을 꺼냅니다.
  const { prompt } = JSON.parse(event.body);

  // 3. OpenAI 서버에 데이터를 보내고 응답을 기다립니다.
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo", // 사용할 AI 모델
      messages: [{ role: "user", content: prompt }], // AI에게 보낼 메시지
    }),
  });

  // 4. OpenAI가 보낸 응답에서 필요한 답변만 추출합니다.
  const data = await response.json();
  const aiResponse = data.choices[0].message.content;

  // 5. 추출한 답변을 다시 원래 웹사이트로 보내줍니다.
  return {
    statusCode: 200,
    body: JSON.stringify({ result: aiResponse }),
  };
};