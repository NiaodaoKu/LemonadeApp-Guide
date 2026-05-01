const GAS_URL = 'https://script.google.com/macros/s/AKfycbx9B_qMLmVGgmOk28NsxSkEclXCB8X3HJJqAOTsFgcMI8TdRBHyjgWsk9VBPNCZs7GR/exec';

export async function onRequestPost(context) {
  try {
    const body = await context.request.text();

    // Step 1: 取得重定向 URL，不自動追蹤
    const init = await fetch(GAS_URL, {
      method: 'POST',
      body: body,
      headers: { 'Content-Type': 'text/plain' },
      redirect: 'manual'
    });

    let gasResponse;
    if (init.status >= 300 && init.status < 400) {
      // Step 2: GAS 已在收到 POST 時執行 doPost()，echo endpoint 只需 GET 取回結果
      const redirectUrl = init.headers.get('Location');
      gasResponse = await fetch(redirectUrl, { method: 'GET' });
    } else {
      gasResponse = init;
    }

    const data = await gasResponse.text();
    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
