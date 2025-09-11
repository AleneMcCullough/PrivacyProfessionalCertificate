// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint64, euint8, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract PrivacyProfessionalCertificate is SepoliaConfig {

    address public owner;
    uint256 public nextCertificateId;

    struct Certificate {
        address holder;
        string profession;
        euint64 encryptedScore;
        euint8 encryptedLevel;
        bool isValid;
        uint256 issueDate;
        uint256 expiryDate;
        string issuer;
        bytes32 hashedCredentials;
    }

    struct CertificationRequest {
        address applicant;
        string profession;
        euint64 encryptedScore;
        euint8 encryptedLevel;
        bool isProcessed;
        bool isApproved;
        uint256 requestTime;
        string evidence;
    }

    mapping(uint256 => Certificate) public certificates;
    mapping(address => uint256[]) public holderCertificates;
    mapping(uint256 => CertificationRequest) public certificationRequests;
    mapping(address => bool) public authorizedIssuers;
    mapping(string => uint256) public minimumScoreRequirement;
    mapping(string => uint8) public minimumLevelRequirement;

    uint256 public nextRequestId;

    event CertificateIssued(uint256 indexed certificateId, address indexed holder, string profession);
    event CertificationRequested(uint256 indexed requestId, address indexed applicant, string profession);
    event CertificationApproved(uint256 indexed requestId, uint256 indexed certificateId);
    event CertificationRejected(uint256 indexed requestId, string reason);
    event CertificateRevoked(uint256 indexed certificateId, string reason);
    event IssuerAuthorized(address indexed issuer, string organization);
    event IssuerRevoked(address indexed issuer);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    modifier onlyAuthorizedIssuer() {
        require(authorizedIssuers[msg.sender] || msg.sender == owner, "Not authorized issuer");
        _;
    }

    modifier validCertificate(uint256 _certificateId) {
        require(_certificateId > 0 && _certificateId <= nextCertificateId, "Invalid certificate ID");
        require(certificates[_certificateId].isValid, "Certificate not valid");
        require(certificates[_certificateId].expiryDate > block.timestamp, "Certificate expired");
        _;
    }

    constructor() {
        owner = msg.sender;
        nextCertificateId = 1;
        nextRequestId = 1;

        // Set default minimum requirements for common professions
        minimumScoreRequirement["Software Engineer"] = 75;
        minimumLevelRequirement["Software Engineer"] = 3;

        minimumScoreRequirement["Data Scientist"] = 80;
        minimumLevelRequirement["Data Scientist"] = 4;

        minimumScoreRequirement["Cybersecurity Specialist"] = 85;
        minimumLevelRequirement["Cybersecurity Specialist"] = 4;

        minimumScoreRequirement["Project Manager"] = 70;
        minimumLevelRequirement["Project Manager"] = 3;
    }

    function authorizeIssuer(address _issuer, string memory _organization) external onlyOwner {
        authorizedIssuers[_issuer] = true;
        emit IssuerAuthorized(_issuer, _organization);
    }

    function revokeIssuer(address _issuer) external onlyOwner {
        authorizedIssuers[_issuer] = false;
        emit IssuerRevoked(_issuer);
    }

    function setProfessionRequirements(
        string memory _profession,
        uint256 _minScore,
        uint8 _minLevel
    ) external onlyOwner {
        minimumScoreRequirement[_profession] = _minScore;
        minimumLevelRequirement[_profession] = _minLevel;
    }

    function requestCertification(
        string memory _profession,
        uint64 _score,
        uint8 _level,
        string memory _evidence
    ) external {
        require(_score <= 100, "Score must be between 0-100");
        require(_level <= 10, "Level must be between 1-10");
        require(bytes(_profession).length > 0, "Profession required");
        require(bytes(_evidence).length > 0, "Evidence required");

        // Encrypt sensitive data
        euint64 encryptedScore = FHE.asEuint64(_score);
        euint8 encryptedLevel = FHE.asEuint8(_level);

        certificationRequests[nextRequestId] = CertificationRequest({
            applicant: msg.sender,
            profession: _profession,
            encryptedScore: encryptedScore,
            encryptedLevel: encryptedLevel,
            isProcessed: false,
            isApproved: false,
            requestTime: block.timestamp,
            evidence: _evidence
        });

        // Set ACL permissions
        FHE.allowThis(encryptedScore);
        FHE.allowThis(encryptedLevel);
        FHE.allow(encryptedScore, msg.sender);
        FHE.allow(encryptedLevel, msg.sender);

        emit CertificationRequested(nextRequestId, msg.sender, _profession);
        nextRequestId++;
    }

    function processCertificationRequest(
        uint256 _requestId,
        string memory _issuerName
    ) external onlyAuthorizedIssuer {
        require(_requestId > 0 && _requestId < nextRequestId, "Invalid request ID");
        require(!certificationRequests[_requestId].isProcessed, "Request already processed");

        CertificationRequest storage request = certificationRequests[_requestId];
        request.isProcessed = true;

        // For demonstration, we'll approve based on encrypted comparison
        // In real implementation, this would use FHE comparison operations
        request.isApproved = true; // Simplified approval logic

        if (request.isApproved) {
            _issueCertificate(
                request.applicant,
                request.profession,
                request.encryptedScore,
                request.encryptedLevel,
                _issuerName
            );
            emit CertificationApproved(_requestId, nextCertificateId - 1);
        } else {
            emit CertificationRejected(_requestId, "Requirements not met");
        }
    }

    function _issueCertificate(
        address _holder,
        string memory _profession,
        euint64 _encryptedScore,
        euint8 _encryptedLevel,
        string memory _issuer
    ) private {
        // Generate credential hash for verification
        bytes32 credentialHash = keccak256(abi.encodePacked(
            _holder,
            _profession,
            block.timestamp,
            nextCertificateId
        ));

        certificates[nextCertificateId] = Certificate({
            holder: _holder,
            profession: _profession,
            encryptedScore: _encryptedScore,
            encryptedLevel: _encryptedLevel,
            isValid: true,
            issueDate: block.timestamp,
            expiryDate: block.timestamp + 365 days, // 1 year validity
            issuer: _issuer,
            hashedCredentials: credentialHash
        });

        holderCertificates[_holder].push(nextCertificateId);

        // Set ACL permissions for the certificate holder
        FHE.allow(_encryptedScore, _holder);
        FHE.allow(_encryptedLevel, _holder);

        emit CertificateIssued(nextCertificateId, _holder, _profession);
        nextCertificateId++;
    }

    function revokeCertificate(uint256 _certificateId, string memory _reason)
        external
        onlyAuthorizedIssuer
        validCertificate(_certificateId)
    {
        certificates[_certificateId].isValid = false;
        emit CertificateRevoked(_certificateId, _reason);
    }

    function verifyCertificate(uint256 _certificateId)
        external
        view
        validCertificate(_certificateId)
        returns (
            address holder,
            string memory profession,
            bool isValid,
            uint256 issueDate,
            uint256 expiryDate,
            string memory issuer,
            bytes32 credentialHash
        )
    {
        Certificate storage cert = certificates[_certificateId];
        return (
            cert.holder,
            cert.profession,
            cert.isValid,
            cert.issueDate,
            cert.expiryDate,
            cert.issuer,
            cert.hashedCredentials
        );
    }

    function getHolderCertificates(address _holder)
        external
        view
        returns (uint256[] memory)
    {
        return holderCertificates[_holder];
    }

    function getCertificateCount() external view returns (uint256) {
        return nextCertificateId - 1;
    }

    function getRequestCount() external view returns (uint256) {
        return nextRequestId - 1;
    }

    function getProfessionRequirements(string memory _profession)
        external
        view
        returns (uint256 minScore, uint8 minLevel)
    {
        return (
            minimumScoreRequirement[_profession],
            minimumLevelRequirement[_profession]
        );
    }

    // Function to extend certificate validity (only by authorized issuers)
    function extendCertificateValidity(uint256 _certificateId, uint256 _additionalDays)
        external
        onlyAuthorizedIssuer
        validCertificate(_certificateId)
    {
        certificates[_certificateId].expiryDate += _additionalDays * 1 days;
    }

    // Emergency function to pause all certificates (only owner)
    function emergencyPause() external onlyOwner {
        // Implementation for emergency pause functionality
        // This could set a global pause state
    }

    // Function to get certificate holder's encrypted score (only accessible by holder or authorized parties)
    function getEncryptedScore(uint256 _certificateId)
        external
        view
        validCertificate(_certificateId)
        returns (euint64)
    {
        require(
            msg.sender == certificates[_certificateId].holder ||
            authorizedIssuers[msg.sender] ||
            msg.sender == owner,
            "Not authorized to view score"
        );
        return certificates[_certificateId].encryptedScore;
    }

    // Function to get certificate holder's encrypted level (only accessible by holder or authorized parties)
    function getEncryptedLevel(uint256 _certificateId)
        external
        view
        validCertificate(_certificateId)
        returns (euint8)
    {
        require(
            msg.sender == certificates[_certificateId].holder ||
            authorizedIssuers[msg.sender] ||
            msg.sender == owner,
            "Not authorized to view level"
        );
        return certificates[_certificateId].encryptedLevel;
    }
}