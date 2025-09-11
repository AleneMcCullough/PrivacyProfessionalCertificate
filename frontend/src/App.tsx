import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

const CONTRACT_ADDRESS = "0xc9B0CD3F8b1fEB158c66d9a5266D054EE89aF153";
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

const CONTRACT_ABI = [
  "function requestCertification(string memory _profession, uint64 _score, uint8 _level, string memory _evidence) external",
  "function processCertificationRequest(uint256 _requestId, string memory _issuerName) external",
  "function verifyCertificate(uint256 _certificateId) external view returns (address holder, string memory profession, bool isValid, uint256 issueDate, uint256 expiryDate, string memory issuer, bytes32 credentialHash)",
  "function getHolderCertificates(address _holder) external view returns (uint256[] memory)",
  "function getCertificateCount() external view returns (uint256)",
  "function getRequestCount() external view returns (uint256)",
  "function getProfessionRequirements(string memory _profession) external view returns (uint256 minScore, uint8 minLevel)",
  "function authorizedIssuers(address) external view returns (bool)",
  "function owner() external view returns (address)",
  "event CertificateIssued(uint256 indexed certificateId, address indexed holder, string profession)",
  "event CertificationRequested(uint256 indexed requestId, address indexed applicant, string profession)",
  "event CertificationApproved(uint256 indexed requestId, uint256 indexed certificateId)"
];

interface WalletState {
  isConnected: boolean;
  account: string;
  network: string;
  balance: string;
  isAdmin: boolean;
}

interface Certificate {
  id: number;
  holder: string;
  profession: string;
  isValid: boolean;
  issueDate: number;
  expiryDate: number;
  issuer: string;
}

function App() {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    account: '',
    network: '',
    balance: '0',
    isAdmin: false
  });

  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [loading, setLoading] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  // Form states
  const [profession, setProfession] = useState('');
  const [score, setScore] = useState('');
  const [level, setLevel] = useState('');
  const [evidence, setEvidence] = useState('');
  const [certificateId, setCertificateId] = useState('');
  const [requestId, setRequestId] = useState('');
  const [issuerName, setIssuerName] = useState('');
  const [verifiedCert, setVerifiedCert] = useState<Certificate | null>(null);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    if (typeof window.ethereum !== 'undefined' && window.ethereum.selectedAddress) {
      await connectWallet();
    }
  };

  const connectWallet = async () => {
    try {
      setLoading('connection');
      setError('');
      setSuccess('');

      // Step 1: Check for MetaMask
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask not found. Please install MetaMask to continue.');
      }

      // Step 2: Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      // Step 3: Create provider and signer
      const newProvider = new ethers.BrowserProvider(window.ethereum);
      const newSigner = await newProvider.getSigner();
      const userAddress = await newSigner.getAddress();

      // Step 4: Check and switch to Sepolia if needed
      const network = await newProvider.getNetwork();
      if (network.chainId.toString() !== "11155111") {
        await switchToSepolia();
      }

      // Step 5: Initialize contract
      const newContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, newSigner);

      // Step 6: Update state
      const balance = await newProvider.getBalance(userAddress);
      const isAdmin = await checkAdminStatus(newContract, userAddress);

      setProvider(newProvider);
      setSigner(newSigner);
      setContract(newContract);
      setWalletState({
        isConnected: true,
        account: userAddress,
        network: `Sepolia (${network.chainId})`,
        balance: ethers.formatEther(balance).slice(0, 6),
        isAdmin
      });

      setSuccess('Successfully connected to Sepolia testnet! ✅');

    } catch (error: any) {
      console.error('Connection error:', error);
      setError(error.message);
      setWalletState(prev => ({ ...prev, isConnected: false }));
    } finally {
      setLoading('');
    }
  };

  const switchToSepolia = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: SEPOLIA_CHAIN_ID,
            chainName: 'Sepolia Test Network',
            nativeCurrency: {
              name: 'SepoliaETH',
              symbol: 'ETH',
              decimals: 18
            },
            rpcUrls: ['https://sepolia.gateway.tenderly.co'],
            blockExplorerUrls: ['https://sepolia.etherscan.io/']
          }]
        });
      } else {
        throw switchError;
      }
    }
  };

  const checkAdminStatus = async (contract: ethers.Contract, address: string): Promise<boolean> => {
    try {
      const isAuthorized = await contract.authorizedIssuers(address);
      const owner = await contract.owner();
      return isAuthorized || address.toLowerCase() === owner.toLowerCase();
    } catch (error) {
      console.error('Admin check error:', error);
      return false;
    }
  };

  const handleCertificationRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !walletState.isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setLoading('request');
      setError('');
      setSuccess('');

      const tx = await contract.requestCertification(profession, parseInt(score), parseInt(level), evidence);
      await tx.wait();

      setSuccess('Certification request submitted successfully!');
      setProfession('');
      setScore('');
      setLevel('');
      setEvidence('');
    } catch (error: any) {
      console.error('Request error:', error);
      setError(`Request failed: ${error.message}`);
    } finally {
      setLoading('');
    }
  };

  const handleVerifyCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !walletState.isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setLoading('verify');
      setError('');
      setSuccess('');

      const result = await contract.verifyCertificate(parseInt(certificateId));

      const cert: Certificate = {
        id: parseInt(certificateId),
        holder: result.holder,
        profession: result.profession,
        isValid: result.isValid,
        issueDate: Number(result.issueDate),
        expiryDate: Number(result.expiryDate),
        issuer: result.issuer
      };

      setVerifiedCert(cert);
      setSuccess('Certificate verified successfully!');
    } catch (error: any) {
      console.error('Verify error:', error);
      setError(`Verification failed: ${error.message}`);
      setVerifiedCert(null);
    } finally {
      setLoading('');
    }
  };

  const loadMyCertificates = async () => {
    if (!contract || !walletState.isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setLoading('certificates');
      setError('');

      const certificateIds = await contract.getHolderCertificates(walletState.account);
      const certs: Certificate[] = [];

      for (const id of certificateIds) {
        try {
          const cert = await contract.verifyCertificate(id);
          certs.push({
            id: Number(id),
            holder: cert.holder,
            profession: cert.profession,
            isValid: cert.isValid,
            issueDate: Number(cert.issueDate),
            expiryDate: Number(cert.expiryDate),
            issuer: cert.issuer
          });
        } catch (error) {
          console.error(`Error loading certificate ${id}:`, error);
        }
      }

      setCertificates(certs);
    } catch (error: any) {
      console.error('Load certificates error:', error);
      setError('Error loading certificates');
    } finally {
      setLoading('');
    }
  };

  const handleProcessRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !walletState.isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setLoading('admin');
      setError('');
      setSuccess('');

      const tx = await contract.processCertificationRequest(parseInt(requestId), issuerName);
      await tx.wait();

      setSuccess('Request processed successfully!');
      setRequestId('');
      setIssuerName('');
    } catch (error: any) {
      console.error('Process error:', error);
      setError(`Processing failed: ${error.message}`);
    } finally {
      setLoading('');
    }
  };

  // Handle account and network changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setWalletState(prev => ({ ...prev, isConnected: false }));
        } else {
          window.location.reload();
        }
      };

      const handleChainChanged = (chainId: string) => {
        if (chainId !== SEPOLIA_CHAIN_ID) {
          setError('Please switch to Sepolia testnet');
          setWalletState(prev => ({ ...prev, isConnected: false }));
        } else {
          window.location.reload();
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  return (
    <div className="app">
      <div className="container">
        <div className="header">
          <h1>Privacy Professional Certificate System</h1>
          <p className="subtitle">Confidential professional certification using Fully Homomorphic Encryption</p>
          <div className={`status ${walletState.isConnected ? 'connected' : 'disconnected'}`}>
            {walletState.isConnected ? 'Connected to Sepolia' : 'Not Connected'}
          </div>
        </div>

        {!walletState.isConnected ? (
          <div className="connection-section">
            <h2>Connect Your Wallet</h2>
            <p>Please connect MetaMask to access the Privacy Professional Certificate System</p>
            <button
              className="connect-btn"
              onClick={connectWallet}
              disabled={loading === 'connection'}
            >
              {loading === 'connection' ? 'Connecting...' : 'Connect MetaMask'}
            </button>
            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}
          </div>
        ) : (
          <>
            <div className="network-info">
              <strong>Network:</strong> {walletState.network} |{' '}
              <strong>Account:</strong> {`${walletState.account.slice(0, 6)}...${walletState.account.slice(-4)}`} |{' '}
              <strong>Balance:</strong> {walletState.balance} ETH
            </div>

            <div className="main-content">
              {/* Request Certificate Card */}
              <div className="card">
                <div className="card-header">
                  <div className="card-icon icon-request">📋</div>
                  <h3>Request Certificate</h3>
                </div>

                <form onSubmit={handleCertificationRequest}>
                  <div className="form-group">
                    <label>Profession</label>
                    <select
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      required
                    >
                      <option value="">Select Profession</option>
                      <option value="Software Engineer">Software Engineer</option>
                      <option value="Data Scientist">Data Scientist</option>
                      <option value="Cybersecurity Specialist">Cybersecurity Specialist</option>
                      <option value="Project Manager">Project Manager</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Professional Score (0-100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                      placeholder="Enter your professional score"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Professional Level (1-10)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      placeholder="Enter your professional level"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Evidence/Portfolio</label>
                    <textarea
                      value={evidence}
                      onChange={(e) => setEvidence(e.target.value)}
                      placeholder="Provide links or descriptions of your professional work..."
                      required
                    />
                  </div>

                  <button type="submit" className="btn" disabled={loading === 'request'}>
                    {loading === 'request' ? 'Processing...' : 'Submit Request'}
                  </button>
                </form>
              </div>

              {/* Verify Certificate Card */}
              <div className="card">
                <div className="card-header">
                  <div className="card-icon icon-verify">🔍</div>
                  <h3>Verify Certificate</h3>
                </div>

                <form onSubmit={handleVerifyCertificate}>
                  <div className="form-group">
                    <label>Certificate ID</label>
                    <input
                      type="number"
                      min="1"
                      value={certificateId}
                      onChange={(e) => setCertificateId(e.target.value)}
                      placeholder="Enter certificate ID to verify"
                      required
                    />
                  </div>

                  <button type="submit" className="btn" disabled={loading === 'verify'}>
                    {loading === 'verify' ? 'Verifying...' : 'Verify Certificate'}
                  </button>
                </form>

                {verifiedCert && (
                  <div className="certificate-details">
                    <h4>Certificate Details</h4>
                    <p><strong>Holder:</strong> {verifiedCert.holder}</p>
                    <p><strong>Profession:</strong> {verifiedCert.profession}</p>
                    <p><strong>Valid:</strong> {verifiedCert.isValid ? 'Yes' : 'No'}</p>
                    <p><strong>Issue Date:</strong> {new Date(verifiedCert.issueDate * 1000).toLocaleDateString()}</p>
                    <p><strong>Expiry Date:</strong> {new Date(verifiedCert.expiryDate * 1000).toLocaleDateString()}</p>
                    <p><strong>Issuer:</strong> {verifiedCert.issuer}</p>
                  </div>
                )}
              </div>

              {/* My Certificates Card */}
              <div className="card">
                <div className="card-header">
                  <div className="card-icon icon-certificate">🏆</div>
                  <h3>My Certificates</h3>
                </div>

                <button className="btn" onClick={loadMyCertificates} disabled={loading === 'certificates'}>
                  {loading === 'certificates' ? 'Loading...' : 'Load My Certificates'}
                </button>

                <div className="certificate-list">
                  {certificates.length === 0 ? (
                    <p>No certificates found.</p>
                  ) : (
                    certificates.map((cert) => (
                      <div key={cert.id} className="certificate-item">
                        <div className="certificate-title">Certificate #{cert.id}</div>
                        <div className="certificate-details">
                          <strong>Profession:</strong> {cert.profession}<br />
                          <strong>Status:</strong> {cert.isValid ? 'Valid' : 'Invalid'}<br />
                          <strong>Issued:</strong> {new Date(cert.issueDate * 1000).toLocaleDateString()}<br />
                          <strong>Expires:</strong> {new Date(cert.expiryDate * 1000).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Admin Panel Card */}
              {walletState.isAdmin && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-icon icon-manage">⚙️</div>
                    <h3>Admin Panel</h3>
                  </div>

                  <form onSubmit={handleProcessRequest}>
                    <div className="form-group">
                      <label>Request ID to Process</label>
                      <input
                        type="number"
                        min="1"
                        value={requestId}
                        onChange={(e) => setRequestId(e.target.value)}
                        placeholder="Enter request ID"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Issuer Name</label>
                      <input
                        type="text"
                        value={issuerName}
                        onChange={(e) => setIssuerName(e.target.value)}
                        placeholder="Enter issuer organization name"
                        required
                      />
                    </div>

                    <button type="submit" className="btn" disabled={loading === 'admin'}>
                      {loading === 'admin' ? 'Processing...' : 'Process Request'}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}
          </>
        )}

        <div className="info-section">
          <h3>About Privacy Professional Certificate System</h3>
          <p>This system uses Fully Homomorphic Encryption (FHE) to protect sensitive professional information while maintaining the ability to verify credentials. Your scores and levels are encrypted and only accessible to authorized parties.</p>

          <h4>Features:</h4>
          <ul>
            <li>🔒 Encrypted professional scores and levels using FHE</li>
            <li>📋 Secure certification request process</li>
            <li>🏆 Tamper-proof digital certificates</li>
            <li>🔍 Public verification without revealing sensitive data</li>
            <li>⚙️ Authorized issuer management system</li>
            <li>🌐 Sepolia testnet integration for testing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;