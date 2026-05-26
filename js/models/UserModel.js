/**
 * Factory Pattern — 使用者資料模型
 * 透過靜態 create() 方法建立結構統一的物件，
 * 避免各處自行組裝物件造成欄位不一致。
 */
class UserModel {
  static create({ name, email, phone, password, role = 'customer' }) {
    return { name, email: email.toLowerCase().trim(), phone: phone || '', password, role };
  }

  static validate({ name, email, password }) {
    const errors = [];
    if (!name || name.trim().length < 2) errors.push('姓名至少 2 個字');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email 格式不正確');
    if (!password || password.length < 6) errors.push('密碼至少 6 個字元');
    return errors;
  }
}

window.UserModel = UserModel;
