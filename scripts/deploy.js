const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying Privacy Professional Certificate contract...");

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // Deploy the contract
    const PrivacyProfessionalCertificate = await ethers.getContractFactory("PrivacyProfessionalCertificate");
    const certificate = await PrivacyProfessionalCertificate.deploy();

    await certificate.deployed();

    console.log("Contract deployed to:", certificate.address);
    console.log("Transaction hash:", certificate.deployTransaction.hash);

    // Wait for a few confirmations
    console.log("Waiting for confirmations...");
    await certificate.deployTransaction.wait(3);

    console.log("Contract deployment confirmed!");

    // Verify initial state
    const owner = await certificate.owner();
    const certificateCount = await certificate.getCertificateCount();
    const requestCount = await certificate.getRequestCount();

    console.log("Contract owner:", owner);
    console.log("Initial certificate count:", certificateCount.toString());
    console.log("Initial request count:", requestCount.toString());

    // Display deployment information for frontend integration
    console.log("\n=== Deployment Summary ===");
    console.log("Contract Address:", certificate.address);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Block Number:", await ethers.provider.getBlockNumber());

    console.log("\n=== Frontend Integration ===");
    console.log("Update the CONTRACT_ADDRESS in index.html:");
    console.log(`const CONTRACT_ADDRESS = "${certificate.address}";`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });