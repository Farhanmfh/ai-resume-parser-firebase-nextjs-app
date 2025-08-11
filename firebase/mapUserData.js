export const mapUserData = async (user) => {
  const tokenResult = await user.getIdTokenResult();

  return {
    id: user.uid,
    email: user.email,
    token: tokenResult.token,
    name: user.displayName,
    role: tokenResult.claims.role || "standardUser",
  };
};
