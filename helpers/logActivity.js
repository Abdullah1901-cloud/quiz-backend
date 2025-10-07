import Logs from '../models/LogModel.js';

export const logActivity = async ({
  req,
  action,
  entity = null,
  identifier = null,
  description = null,
}) => {
  try {
    const user_id = req?.session?.user?.user_id || 'anonymous';

    let ip_address =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip ||
      'unknown';

    // Bersihkan IPv4-mapped IPv6
    if (ip_address.startsWith('::ffff:')) {
      ip_address = ip_address.replace('::ffff:', '');
    }
    await Logs.create({
      user_id,
      action,
      entity,
      identifier,
      description,
      ip_address,
    });
  } catch (error) {
    console.error('Log gagal disimpan:', error.message);
  }
};
