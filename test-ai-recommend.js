import fetch from 'node-fetch';

fetch('http://localhost:3000/api/ai/recommendations')
  .then(res => res.json())
  .then(data => {
    console.log('Kết quả gợi ý AI:', JSON.stringify(data, null, 2));
  })
  .catch(err => {
    console.error('Lỗi gọi API gợi ý AI:', err);
  });
