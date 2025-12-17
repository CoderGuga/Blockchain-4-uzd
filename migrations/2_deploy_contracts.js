const Deal = artifacts.require("Deal");

module.exports = function(deployer, network, accounts) {
  const creator = accounts[0];
  const buyer = accounts[1];
  
  deployer.deploy(Deal, buyer, { from: creator });
};