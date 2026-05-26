/** Singleton Repository — 使用者 */
class UserRepository extends BaseRepository {
  constructor() { super('agenttt_users'); }

  findByEmail(email) {
    return this.find(u => u.email === email.toLowerCase().trim())[0] || null;
  }

  findByEmailAndPassword(email, password) {
    return this.find(u => u.email === email.toLowerCase().trim() && u.password === password)[0] || null;
  }
}

window.userRepo = new UserRepository();
