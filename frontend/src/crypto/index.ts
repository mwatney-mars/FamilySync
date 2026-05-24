// Utilitários de Criptografia de Ponta a Ponta (E2EE) usando a Web Crypto API do navegador
// Possui fallback automático para criptografia pura em JS caso o contexto seja inseguro (HTTP sem SSL)

class E2EEEncryptionService {
  private cryptoKey: any = null;
  private fallbackPassphrase: string | null = null;

  // Verifica se o Subtle Crypto está disponível no navegador atual (requer HTTPS ou localhost)
  private isSubtleAvailable(): boolean {
    return !!(window.crypto && window.crypto.subtle);
  }

  // Converte string para ArrayBuffer
  private strToBuffer(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }

  // Converte ArrayBuffer para string
  private bufferToStr(buf: ArrayBuffer): string {
    return new TextDecoder().decode(buf);
  }

  // Converte ArrayBuffer para Base64 (seguro para tráfego JSON)
  private bufferToBase64(buf: ArrayBuffer | Uint8Array): string {
    const uint8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const binString = Array.from(uint8)
      .map(x => String.fromCharCode(x))
      .join('');
    return btoa(binString);
  }

  // Converte Base64 para ArrayBuffer
  private base64ToBuffer(b64: string): Uint8Array {
    const binString = atob(b64);
    return Uint8Array.from(binString, c => c.charCodeAt(0));
  }

  // Cifra/Decifra simples em Javascript usando XOR para cenários de fallback (HTTP)
  private xorEncryptDecrypt(input: string, key: string): string {
    let output = '';
    const keyStr = key || 'FamilySyncFallbackKey';
    for (let i = 0; i < input.length; i++) {
      const charCode = input.charCodeAt(i) ^ keyStr.charCodeAt(i % keyStr.length);
      output += String.fromCharCode(charCode);
    }
    return output;
  }

  // Deriva uma chave AES-GCM de 256 bits a partir de uma senha e salt usando PBKDF2
  async deriveKey(passphrase: string, saltHex: string): Promise<any> {
    if (!this.isSubtleAvailable()) {
      console.warn('A API Web Crypto (Subtle) não está disponível neste contexto (provavelmente HTTP inseguro). Utilizando fallback leve em JS.');
      this.fallbackPassphrase = passphrase;
      this.cryptoKey = { type: 'fallback' };
      return this.cryptoKey;
    }

    try {
      const salt = Uint8Array.from(
        saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );
      
      // Importar a frase secreta como chave bruta
      const baseKey = await window.crypto.subtle.importKey(
        'raw',
        this.strToBuffer(passphrase) as any,
        { name: 'PBKDF2' },
        false,
        ['deriveKey', 'deriveBits']
      );

      // Derivar a chave de criptografia simétrica AES-GCM
      this.cryptoKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false, // Não exportável por motivos de segurança
        ['encrypt', 'decrypt']
      );

      return this.cryptoKey;
    } catch (err) {
      console.error('Erro ao derivar chave via Web Crypto:', err);
      throw err;
    }
  }

  // Verifica se a chave de criptografia já foi gerada e está em memória
  isKeyLoaded(): boolean {
    return this.cryptoKey !== null || this.fallbackPassphrase !== null;
  }

  // Limpa a chave em memória (útil para logout)
  clearKey() {
    this.cryptoKey = null;
    this.fallbackPassphrase = null;
  }

  // Criptografa um objeto Javascript qualquer
  async encrypt(data: any): Promise<string> {
    if (!this.cryptoKey && !this.fallbackPassphrase) {
      throw new Error('Chave de criptografia E2EE não carregada. Defina a Senha da Família nas configurações.');
    }

    // Usar algoritmo de fallback caso subtle não esteja disponível
    if (!this.isSubtleAvailable()) {
      const plaintextJson = JSON.stringify(data);
      // Codificar em URI para tratar caracteres unicode/acentos com segurança
      const safePlaintext = encodeURIComponent(plaintextJson);
      const cipherText = this.xorEncryptDecrypt(safePlaintext, this.fallbackPassphrase || 'default');
      return 'FALLBACK_E2EE:' + btoa(cipherText);
    }

    const plaintext = JSON.stringify(data);
    const plaintextBuffer = this.strToBuffer(plaintext);
    
    // Gerar vetor de inicialização (IV) aleatório de 12 bytes para o AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Criptografar os dados
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      this.cryptoKey,
      plaintextBuffer as any
    );

    // Empacotar o IV (12 bytes) e os dados criptografados juntos no mesmo buffer
    const resultBuffer = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
    resultBuffer.set(iv, 0);
    resultBuffer.set(new Uint8Array(ciphertextBuffer), iv.length);

    // Retornar em Base64
    return this.bufferToBase64(resultBuffer);
  }

  // Descriptografa uma string Base64 retornando o objeto Javascript original
  async decrypt(encryptedBase64: string): Promise<any> {
    if (!this.cryptoKey && !this.fallbackPassphrase) {
      throw new Error('Chave de criptografia E2EE não carregada. Defina a Senha da Família nas configurações.');
    }

    // Se o dado foi criptografado com o método de fallback
    if (encryptedBase64.startsWith('FALLBACK_E2EE:')) {
      const b64Part = encryptedBase64.substring('FALLBACK_E2EE:'.length);
      const cipherText = atob(b64Part);
      const safePlaintext = this.xorEncryptDecrypt(cipherText, this.fallbackPassphrase || 'default');
      const plaintextJson = decodeURIComponent(safePlaintext);
      return JSON.parse(plaintextJson);
    }

    // Se o dado é AES-GCM mas o navegador atual não tem subtle (caso de migração/mudança de navegador)
    if (!this.isSubtleAvailable()) {
      throw new Error('Este dado foi criptografado com criptografia real AES-GCM. O navegador atual não possui suporte a Web Crypto (subtle) para descriptografá-lo neste contexto inseguro (HTTP). Acesse via HTTPS.');
    }

    try {
      const encryptedBuffer = this.base64ToBuffer(encryptedBase64);
      
      // Extrair o IV (primeiros 12 bytes)
      const iv = encryptedBuffer.slice(0, 12);
      
      // Extrair o texto criptografado (resto do buffer)
      const ciphertext = encryptedBuffer.slice(12);

      // Descriptografar
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.cryptoKey,
        ciphertext
      );

      const plaintext = this.bufferToStr(decryptedBuffer);
      return JSON.parse(plaintext);
    } catch (err) {
      console.error('Falha ao descriptografar dado via Web Crypto:', err);
      throw new Error('Falha de criptografia: a chave E2EE da família parece incorreta.', { cause: err });
    }
  }
}

export const E2EEService = new E2EEEncryptionService();
