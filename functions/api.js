const GAS_URL = 'https://script.google.com/macros/s/AKfycbx9B_qMLmVGgmOk28NsxSkEclXCB8X3HJJqAOTsFgcMI8TdRBHyjgWsk9VBPNCZs7GR/exec';

export async function onRequestPost(context) {
  try {
    const body = await context.request.text();
    const gasResponse = await fetch(GAS_URL, {
      method: 'POST',
      body: body,
      headers: { 'Content-Type': 'text/plain' },
      redirect: 'follow'
    });
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
