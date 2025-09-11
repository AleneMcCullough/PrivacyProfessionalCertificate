# Hello FHEVM: Your First Confidential dApp Tutorial

Welcome to the ultimate beginner's guide for building your first confidential application using Fully Homomorphic Encryption Virtual Machine (FHEVM). This tutorial will walk you through creating a complete privacy-preserving professional certificate system from scratch.

## 🎯 Learning Objectives

By the end of this tutorial, you will:
- Understand the basics of FHEVM and confidential computing
- Build and deploy your first FHE smart contract
- Create a user-friendly frontend for your confidential dApp
- Implement encrypted data operations without requiring cryptography knowledge
- Deploy a complete privacy-preserving application

## 📋 Prerequisites

### Required Knowledge
- **Solidity Basics**: Ability to write and deploy simple smart contracts
- **JavaScript/React**: Basic frontend development skills
- **Ethereum Development**: Familiarity with MetaMask, Hardhat, or similar tools

### What You DON'T Need
- ❌ Advanced mathematics or cryptography knowledge
- ❌ Prior experience with FHE or confidential computing
- ❌ Complex blockchain development experience

## 🛠️ Development Environment Setup

### Step 1: Install Dependencies

First, ensure you have Node.js (v16+) installed, then create a new project:

```bash
mkdir privacy-certificate-app
cd privacy-certificate-app
npm init -y
```

Install the required packages:

```bash
# Core development dependencies
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# FHEVM specific packages
npm install fhevm fhevmjs

# Frontend dependencies
npm install react react-dom @types/react @types/react-dom
npm install ethers@5.7.2
```

### Step 2: Initialize Hardhat

```bash
npx hardhat init
```

Select "Create a TypeScript project" when prompted.

### Step 3: Configure Hardhat for FHEVM

Update your `hardhat.config.ts`:

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    zama: {
      url: "https://devnet.zama.ai/",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8009,
    },
  },
};

export default config;
```

## 🔐 Understanding FHEVM Concepts

### What is FHEVM?

FHEVM (Fully Homomorphic Encryption Virtual Machine) allows you to perform computations on encrypted data without ever decrypting it. Think of it as a magic box where you can:

1. **Input encrypted data** (like a sealed envelope)
2. **Perform operations** (without opening the envelope)
3. **Get encrypted results** (still in a sealed envelope)
4. **Only the authorized party can decrypt** the final result

### Key FHEVM Data Types

```solidity
// Basic encrypted types
euint8   // Encrypted 8-bit integer (0-255)
euint16  // Encrypted 16-bit integer (0-65535)
euint32  // Encrypted 32-bit integer
euint64  // Encrypted 64-bit integer
ebool    // Encrypted boolean (true/false)
```

### FHEVM Operations

```solidity
// Arithmetic operations
TFHE.add(a, b)     // Encrypted addition
TFHE.sub(a, b)     // Encrypted subtraction
TFHE.mul(a, b)     // Encrypted multiplication

// Comparison operations
TFHE.eq(a, b)      // Encrypted equality check
TFHE.lt(a, b)      // Encrypted less than
TFHE.gt(a, b)      // Encrypted greater than

// Logical operations
TFHE.and(a, b)     // Encrypted AND
TFHE.or(a, b)      // Encrypted OR
TFHE.not(a)        // Encrypted NOT
```

## 📜 Building Your First FHE Smart Contract

### Step 1: Create the Certificate Contract

Create `contracts/PrivacyCertificate.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "fhevm/lib/TFHE.sol";

contract PrivacyCertificate {
    // Structure to store encrypted certificate data
    struct Certificate {
        euint32 certificationLevel;  // Encrypted certification level (1-10)
        euint32 experienceYears;     // Encrypted years of experience
        ebool isActive;              // Encrypted active status
        euint32 issueTimestamp;      // Encrypted issue timestamp
        address holder;              // Public address of certificate holder
    }

    // Mapping from certificate ID to certificate data
    mapping(uint256 => Certificate) public certificates;

    // Mapping from address to their certificate IDs
    mapping(address => uint256[]) public holderCertificates;

    // Counter for certificate IDs
    uint256 public certificateCounter;

    // Events
    event CertificateIssued(uint256 indexed certificateId, address indexed holder);
    event CertificateUpdated(uint256 indexed certificateId);

    constructor() {
        certificateCounter = 0;
    }

    /**
     * @dev Issue a new encrypted certificate
     * @param encryptedLevel Encrypted certification level
     * @param encryptedExperience Encrypted years of experience
     * @param encryptedActive Encrypted active status
     */
    function issueCertificate(
        einput encryptedLevel,
        einput encryptedExperience,
        einput encryptedActive
    ) public returns (uint256) {
        // Convert encrypted inputs to FHEVM types
        euint32 level = TFHE.asEuint32(encryptedLevel);
        euint32 experience = TFHE.asEuint32(encryptedExperience);
        ebool active = TFHE.asEbool(encryptedActive);

        // Create encrypted timestamp
        euint32 timestamp = TFHE.asEuint32(block.timestamp);

        // Increment certificate counter
        certificateCounter++;
        uint256 certificateId = certificateCounter;

        // Store the certificate
        certificates[certificateId] = Certificate({
            certificationLevel: level,
            experienceYears: experience,
            isActive: active,
            issueTimestamp: timestamp,
            holder: msg.sender
        });

        // Add to holder's certificate list
        holderCertificates[msg.sender].push(certificateId);

        // Emit event
        emit CertificateIssued(certificateId, msg.sender);

        return certificateId;
    }

    /**
     * @dev Verify if a certificate meets minimum requirements
     * @param certificateId The ID of the certificate to verify
     * @param minLevel Minimum required certification level
     * @param minExperience Minimum required experience years
     */
    function verifyCertificate(
        uint256 certificateId,
        einput minLevel,
        einput minExperience
    ) public view returns (ebool) {
        Certificate memory cert = certificates[certificateId];

        // Convert inputs to FHEVM types
        euint32 requiredLevel = TFHE.asEuint32(minLevel);
        euint32 requiredExperience = TFHE.asEuint32(minExperience);

        // Check if certificate meets requirements
        ebool levelMet = TFHE.ge(cert.certificationLevel, requiredLevel);
        ebool experienceMet = TFHE.ge(cert.experienceYears, requiredExperience);
        ebool isActiveCert = cert.isActive;

        // All conditions must be true
        ebool result = TFHE.and(levelMet, experienceMet);
        result = TFHE.and(result, isActiveCert);

        return result;
    }

    /**
     * @dev Update certificate status (only by holder)
     * @param certificateId The ID of the certificate to update
     * @param newStatus New encrypted active status
     */
    function updateCertificateStatus(
        uint256 certificateId,
        einput newStatus
    ) public {
        require(
            certificates[certificateId].holder == msg.sender,
            "Only certificate holder can update"
        );

        certificates[certificateId].isActive = TFHE.asEbool(newStatus);
        emit CertificateUpdated(certificateId);
    }

    /**
     * @dev Get certificate holder's address (public information)
     * @param certificateId The ID of the certificate
     */
    function getCertificateHolder(uint256 certificateId) public view returns (address) {
        return certificates[certificateId].holder;
    }

    /**
     * @dev Get all certificate IDs for a holder
     * @param holder The address of the certificate holder
     */
    function getHolderCertificates(address holder) public view returns (uint256[] memory) {
        return holderCertificates[holder];
    }

    /**
     * @dev Decrypt certificate level (only by holder)
     * @param certificateId The ID of the certificate
     */
    function decryptCertificationLevel(uint256 certificateId) public view returns (uint32) {
        require(
            certificates[certificateId].holder == msg.sender,
            "Only holder can decrypt their certificate"
        );

        return TFHE.decrypt(certificates[certificateId].certificationLevel);
    }

    /**
     * @dev Decrypt experience years (only by holder)
     * @param certificateId The ID of the certificate
     */
    function decryptExperienceYears(uint256 certificateId) public view returns (uint32) {
        require(
            certificates[certificateId].holder == msg.sender,
            "Only holder can decrypt their certificate"
        );

        return TFHE.decrypt(certificates[certificateId].experienceYears);
    }
}
```

### Step 2: Deploy Script

Create `scripts/deploy.ts`:

```typescript
import { ethers } from "hardhat";

async function main() {
  console.log("Deploying PrivacyCertificate contract...");

  const PrivacyCertificate = await ethers.getContractFactory("PrivacyCertificate");
  const contract = await PrivacyCertificate.deploy();

  await contract.deployed();

  console.log(`PrivacyCertificate deployed to: ${contract.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### Step 3: Compile and Deploy

```bash
# Compile the contract
npx hardhat compile

# Deploy to Zama testnet
npx hardhat run scripts/deploy.ts --network zama
```

## 🌐 Building the Frontend

### Step 1: Create React Components

Create `src/App.js`:

```jsx
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { FhevmInstance } from 'fhevmjs';
import './App.css';

// Your deployed contract address
const CONTRACT_ADDRESS = "YOUR_DEPLOYED_CONTRACT_ADDRESS";
const CONTRACT_ABI = [
  // Add your contract ABI here
];

function App() {
  const [account, setAccount] = useState('');
  const [fhevmInstance, setFhevmInstance] = useState(null);
  const [contract, setContract] = useState(null);
  const [certificates, setCertificates] = useState([]);

  // Form states
  const [certLevel, setCertLevel] = useState('');
  const [experience, setExperience] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Verification states
  const [verifyId, setVerifyId] = useState('');
  const [minLevel, setMinLevel] = useState('');
  const [minExperience, setMinExperience] = useState('');

  useEffect(() => {
    initializeFHEVM();
  }, []);

  const initializeFHEVM = async () => {
    try {
      // Initialize FHEVM instance
      const instance = await FhevmInstance.create({
        chainId: 8009, // Zama testnet
        publicKeyId: '0x1234567890abcdef', // Replace with actual public key
      });
      setFhevmInstance(instance);

      // Connect to MetaMask
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        setAccount(address);

        // Initialize contract
        const contractInstance = new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          signer
        );
        setContract(contractInstance);

        loadCertificates(address, contractInstance);
      }
    } catch (error) {
      console.error("Failed to initialize FHEVM:", error);
    }
  };

  const loadCertificates = async (address, contractInstance) => {
    try {
      const certIds = await contractInstance.getHolderCertificates(address);
      setCertificates(certIds.map(id => id.toString()));
    } catch (error) {
      console.error("Failed to load certificates:", error);
    }
  };

  const issueCertificate = async () => {
    if (!fhevmInstance || !contract) return;

    try {
      // Encrypt the inputs
      const encryptedLevel = fhevmInstance.encrypt32(parseInt(certLevel));
      const encryptedExperience = fhevmInstance.encrypt32(parseInt(experience));
      const encryptedActive = fhevmInstance.encryptBool(isActive);

      // Call the contract
      const tx = await contract.issueCertificate(
        encryptedLevel,
        encryptedExperience,
        encryptedActive
      );

      await tx.wait();
      alert("Certificate issued successfully!");

      // Reload certificates
      loadCertificates(account, contract);

      // Reset form
      setCertLevel('');
      setExperience('');
      setIsActive(true);
    } catch (error) {
      console.error("Failed to issue certificate:", error);
      alert("Failed to issue certificate");
    }
  };

  const verifyCertificate = async () => {
    if (!fhevmInstance || !contract) return;

    try {
      // Encrypt the verification criteria
      const encryptedMinLevel = fhevmInstance.encrypt32(parseInt(minLevel));
      const encryptedMinExperience = fhevmInstance.encrypt32(parseInt(minExperience));

      // Call verification function
      const result = await contract.verifyCertificate(
        verifyId,
        encryptedMinLevel,
        encryptedMinExperience
      );

      // Note: result is encrypted, you'd need proper decryption rights
      alert("Verification request sent! Result is encrypted.");
    } catch (error) {
      console.error("Failed to verify certificate:", error);
      alert("Failed to verify certificate");
    }
  };

  const decryptCertificate = async (certificateId) => {
    if (!contract) return;

    try {
      const level = await contract.decryptCertificationLevel(certificateId);
      const experience = await contract.decryptExperienceYears(certificateId);

      alert(`Certificate ${certificateId}:\nLevel: ${level}\nExperience: ${experience} years`);
    } catch (error) {
      console.error("Failed to decrypt certificate:", error);
      alert("Failed to decrypt certificate");
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔐 Privacy Professional Certificate</h1>
        <p>Your First FHEVM Application</p>
        {account && <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>}
      </header>

      <main className="App-main">
        {/* Certificate Issuance Section */}
        <section className="certificate-section">
          <h2>Issue New Certificate</h2>
          <div className="form-group">
            <label>Certification Level (1-10):</label>
            <input
              type="number"
              min="1"
              max="10"
              value={certLevel}
              onChange={(e) => setCertLevel(e.target.value)}
              placeholder="Enter certification level"
            />
          </div>

          <div className="form-group">
            <label>Years of Experience:</label>
            <input
              type="number"
              min="0"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="Enter years of experience"
            />
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Certificate is active
            </label>
          </div>

          <button
            onClick={issueCertificate}
            disabled={!certLevel || !experience}
            className="primary-button"
          >
            Issue Certificate
          </button>
        </section>

        {/* Certificates Display */}
        <section className="certificates-section">
          <h2>My Certificates</h2>
          {certificates.length === 0 ? (
            <p>No certificates found. Issue your first certificate above!</p>
          ) : (
            <div className="certificates-grid">
              {certificates.map((certId) => (
                <div key={certId} className="certificate-card">
                  <h3>Certificate #{certId}</h3>
                  <button
                    onClick={() => decryptCertificate(certId)}
                    className="secondary-button"
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Verification Section */}
        <section className="verification-section">
          <h2>Verify Certificate</h2>
          <div className="form-group">
            <label>Certificate ID to Verify:</label>
            <input
              type="number"
              value={verifyId}
              onChange={(e) => setVerifyId(e.target.value)}
              placeholder="Enter certificate ID"
            />
          </div>

          <div className="form-group">
            <label>Minimum Level Required:</label>
            <input
              type="number"
              min="1"
              max="10"
              value={minLevel}
              onChange={(e) => setMinLevel(e.target.value)}
              placeholder="Minimum certification level"
            />
          </div>

          <div className="form-group">
            <label>Minimum Experience Required:</label>
            <input
              type="number"
              min="0"
              value={minExperience}
              onChange={(e) => setMinExperience(e.target.value)}
              placeholder="Minimum years of experience"
            />
          </div>

          <button
            onClick={verifyCertificate}
            disabled={!verifyId || !minLevel || !minExperience}
            className="primary-button"
          >
            Verify Certificate
          </button>
        </section>
      </main>
    </div>
  );
}

export default App;
```

### Step 2: Add CSS Styling

Create `src/App.css`:

```css
.App {
  text-align: center;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.App-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40px 20px;
  border-radius: 12px;
  color: white;
  margin-bottom: 40px;
}

.App-header h1 {
  margin: 0 0 10px 0;
  font-size: 2.5rem;
}

.App-main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  align-items: start;
}

.certificate-section,
.certificates-section,
.verification-section {
  background: #f8f9fa;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.verification-section {
  grid-column: 1 / -1;
}

.form-group {
  margin-bottom: 20px;
  text-align: left;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s ease;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.primary-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease;
  width: 100%;
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-2px);
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-button {
  background: #6c757d;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.secondary-button:hover {
  background: #5a6268;
}

.certificates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

.certificate-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 2px solid #e9ecef;
  transition: border-color 0.3s ease;
}

.certificate-card:hover {
  border-color: #667eea;
}

.certificate-card h3 {
  margin: 0 0 15px 0;
  color: #333;
}

@media (max-width: 768px) {
  .App-main {
    grid-template-columns: 1fr;
  }

  .certificates-grid {
    grid-template-columns: 1fr;
  }
}
```

## 🧪 Testing Your Application

### Step 1: Unit Tests

Create `test/PrivacyCertificate.test.ts`:

```typescript
import { expect } from "chai";
import { ethers } from "hardhat";
import { PrivacyCertificate } from "../typechain-types";

describe("PrivacyCertificate", function () {
  let contract: PrivacyCertificate;
  let owner: any;
  let user1: any;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    const PrivacyCertificate = await ethers.getContractFactory("PrivacyCertificate");
    contract = await PrivacyCertificate.deploy();
    await contract.deployed();
  });

  it("Should issue a certificate", async function () {
    // This is a simplified test - in reality, you'd need to handle encrypted inputs
    const tx = await contract.connect(user1).issueCertificate(
      "0x1234", // Mock encrypted level
      "0x5678", // Mock encrypted experience
      "0x01"    // Mock encrypted active status
    );

    await tx.wait();

    const certificates = await contract.getHolderCertificates(user1.address);
    expect(certificates.length).to.equal(1);
  });

  it("Should return correct certificate holder", async function () {
    await contract.connect(user1).issueCertificate("0x1234", "0x5678", "0x01");

    const holder = await contract.getCertificateHolder(1);
    expect(holder).to.equal(user1.address);
  });
});
```

Run tests:

```bash
npx hardhat test
```

## 🚀 Advanced Features and Best Practices

### Privacy Considerations

1. **Data Minimization**: Only encrypt sensitive data that needs computation
2. **Access Control**: Implement proper permissions for decryption
3. **Key Management**: Secure handling of encryption keys

### Performance Optimization

1. **Gas Efficiency**: FHE operations are expensive, optimize carefully
2. **Batch Operations**: Group multiple operations when possible
3. **State Management**: Minimize encrypted state variables

### Security Best Practices

1. **Input Validation**: Always validate encrypted inputs
2. **Access Controls**: Implement proper role-based permissions
3. **Audit Trail**: Log important operations for compliance

## 🎉 Congratulations!

You've successfully built your first FHEVM application! You now understand:

- ✅ How to set up FHEVM development environment
- ✅ Writing smart contracts with encrypted data types
- ✅ Performing computations on encrypted data
- ✅ Building a frontend that interacts with FHE contracts
- ✅ Managing privacy-preserving operations

## 🔄 Next Steps

### Enhance Your Application

1. **Add More Certificate Types**: Support different professional domains
2. **Implement Revocation**: Add certificate revocation functionality
3. **Multi-party Verification**: Allow multiple parties to verify certificates
4. **Integration**: Connect with existing professional networks

### Learn More

- **FHEVM Documentation**: [https://docs.zama.ai/fhevm](https://docs.zama.ai/fhevm)
- **Advanced Tutorials**: Explore more complex FHE patterns
- **Community**: Join the FHEVM developer community

### Deploy to Production

1. **Security Audit**: Get your contracts audited
2. **Gas Optimization**: Optimize for production costs
3. **User Experience**: Enhance frontend for better usability
4. **Documentation**: Create comprehensive user guides

## 📚 Troubleshooting

### Common Issues

**"Failed to initialize FHEVM"**
- Check network configuration
- Verify public key ID
- Ensure proper MetaMask setup

**"Encryption failed"**
- Verify input data types
- Check FHEVM instance initialization
- Ensure proper error handling

**"Transaction reverted"**
- Check gas limits
- Verify encrypted input format
- Review contract permissions

### Getting Help

- **Documentation**: Check official FHEVM docs
- **Community Forums**: Ask questions in developer communities
- **GitHub Issues**: Report bugs and request features

---

This tutorial provides a complete foundation for building confidential applications with FHEVM. The privacy-preserving certificate system demonstrates real-world use cases while teaching fundamental concepts that can be applied to any confidential computing project.

Happy building! 🔐✨