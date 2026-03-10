export const validateUsername = (name) => {
  if (!name || name.trim() === '') {
    return { valid: false, message: '사용자 이름을 입력해주세요.' };
  }
  if (name.length > 8) {
    return { valid: false, message: '사용자 이름은 8자 이하여야 합니다.' };
  }
  return { valid: true };
};
