interface IKeyConfig {
  // Service Account authentication (existing)
  clientEmail?: string;
  privateKey?: string;

  // OAuth2 authentication (new)
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
}

export default IKeyConfig;
