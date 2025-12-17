import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import './App.css';

export default function DealApp() {
  const [web3, setWeb3] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [contract, setContract] = useState(null);
  const [currentAccount, setCurrentAccount] = useState('');
  const [creator, setCreator] = useState('');
  const [buyer, setBuyer] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [networkId, setNetworkId] = useState(null);
  const [contractAddress, setContractAddress] = useState('');
  
  // Form states
  const [gameName, setGameName] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [price, setPrice] = useState('');
  const [paymentOrderNo, setPaymentOrderNo] = useState('');
  const [viewOrderNo, setViewOrderNo] = useState('');
  const [orderDetails, setOrderDetails] = useState(null);
  const [refundWindow, setRefundWindow] = useState('0');

  useEffect(() => {
    initWeb3();
  }, []);

  useEffect(() => {
    if (contract) {
      setupEventListeners();
    }
  }, [contract]);

  const initWeb3 = async () => {
    try {
      // Check if MetaMask is installed
      if (!window.ethereum) {
        setMessage('Please install MetaMask!');
        return;
      }

      setMessage('Connecting to MetaMask...');
      
      const web3Instance = new Web3(window.ethereum);
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      const accs = await web3Instance.eth.getAccounts();
      const netId = await web3Instance.eth.net.getId();
      
      console.log('Network ID:', netId);
      console.log('Accounts:', accs);
      
      setNetworkId(netId);
      setMessage('Loading contract...');
      
      // Import contract JSON
      let DealContract;
      try {
        DealContract = require('./contracts/Deal.json');
        console.log('Contract JSON loaded');
      } catch (err) {
        setMessage('Contract JSON not found. Did you run "truffle migrate"?');
        console.error('Contract import error:', err);
        return;
      }
      
      const deployedNetwork = DealContract.networks[netId];
      
      if (!deployedNetwork) {
        setMessage(`Contract not deployed to network ${netId}. Please run "truffle migrate --reset"`);
        console.log('Available networks:', Object.keys(DealContract.networks));
        return;
      }
      
      console.log('Contract address:', deployedNetwork.address);
      setContractAddress(deployedNetwork.address);
      
      const instance = new web3Instance.eth.Contract(
        DealContract.abi,
        deployedNetwork.address
      );
      
      console.log('Contract instance created');
      
      setWeb3(web3Instance);
      setAccounts(accs);
      setCurrentAccount(accs[0]);
      setContract(instance);
      
      // Load contract data
      try {
        const creatorAddr = await instance.methods.creator().call();
        const buyerAddr = await instance.methods.buyer().call();
        console.log('Creator:', creatorAddr);
        console.log('Buyer:', buyerAddr);
        setCreator(creatorAddr);
        setBuyer(buyerAddr);
        setMessage('Connected successfully!');
      } catch (err) {
        console.error('Error loading contract data:', err);
        setMessage('Contract loaded but error reading data: ' + err.message);
      }
      
      // Listen for account changes
      window.ethereum.on('accountsChanged', (newAccounts) => {
        console.log('Account changed:', newAccounts);
        setAccounts(newAccounts);
        setCurrentAccount(newAccounts[0]);
        setMessage('Account changed to: ' + newAccounts[0].substring(0, 10) + '...');
      });

      // Listen for network changes
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
      
    } catch (error) {
      console.error('Init error:', error);
      setMessage('Error: ' + error.message);
    }
  };

  const setupEventListeners = () => {
    contract.events.OrderSent({}, (error, event) => {
      if (!error) {
        setMessage(`Order Sent: ${event.returnValues.game}, Order #${event.returnValues.orderno}`);
      }
    });

    contract.events.OrderConfirmed({}, (error, event) => {
      if (!error) {
        setMessage(`Order Confirmed: #${event.returnValues.orderno}, Price: ${web3.utils.fromWei(event.returnValues.price, 'ether')} ETH`);
      }
    });

    contract.events.PaymentReceived({}, (error, event) => {
      if (!error) {
        setMessage(`Payment Received for Order #${event.returnValues.orderno}`);
      }
    });

    contract.events.RefundSuccessful({}, (error, event) => {
      if (!error) {
        setMessage(`️Refund Successful for Order #${event.returnValues.orderno}`);
      }
    });

    contract.events.PayoutSuccessful({}, (error, event) => {
      if (!error) {
        setMessage(`Payout Successful for Order #${event.returnValues.orderno}`);
      }
    });
  };

  const sendOrder = async () => {
    if (!gameName) {
      setMessage('Please enter a game name');
      return;
    }
    setLoading(true);
    try {
      await contract.methods.sendOrder(gameName).send({ from: currentAccount });
      setMessage('Order sent successfully!');
      setGameName('');
    } catch (error) {
      console.error(error);
      setMessage('Error: ' + (error.message || 'Transaction failed'));
    }
    setLoading(false);
  };

  const confirmOrder = async () => {
    if (!orderNo || !price) {
      setMessage('️Please enter order number and price');
      return;
    }
    setLoading(true);
    try {
      const priceInWei = web3.utils.toWei(price, 'ether');
      await contract.methods.ConfirmOrder(orderNo, priceInWei).send({ from: currentAccount });
      setMessage('Order confirmed successfully!');
      setOrderNo('');
      setPrice('');
    } catch (error) {
      console.error(error);
      setMessage('Error: ' + (error.message || 'Transaction failed'));
    }
    setLoading(false);
  };

  const sendPayment = async () => {
    if (!paymentOrderNo) {
      setMessage('️Please enter order number');
      return;
    }
    setLoading(true);
    try {
      const orderPrice = await contract.methods.getPrice(paymentOrderNo).call();
      if (orderPrice === '0') {
        setMessage('️Order not confirmed yet or doesn\'t exist');
        setLoading(false);
        return;
      }
      await contract.methods.SendPayment(paymentOrderNo).send({ 
        from: currentAccount,
        value: orderPrice
      });
      setMessage('Payment sent successfully!');
      setPaymentOrderNo('');
    } catch (error) {
      console.error(error);
      setMessage('Error: ' + (error.message || 'Transaction failed'));
    }
    setLoading(false);
  };

  const returnProduct = async () => {
    if (!orderNo) {
      setMessage('️Please enter order number');
      return;
    }
    setLoading(true);
    try {
      await contract.methods.ReturnProduct(orderNo).send({ from: currentAccount });
      setMessage('Refund processed successfully!');
    } catch (error) {
      console.error(error);
      setMessage('Error: ' + (error.message || 'Transaction failed'));
    }
    setLoading(false);
  };

  const requestPayout = async () => {
    if (!orderNo) {
      setMessage('️Please enter order number');
      return;
    }
    setLoading(true);
    try {
      await contract.methods.Payout(orderNo).send({ from: currentAccount });
      setMessage('Payout successful!');
    } catch (error) {
      console.error(error);
      setMessage('Error: ' + (error.message || 'Transaction failed'));
    }
    setLoading(false);
  };

  const viewOrder = async () => {
    if (!viewOrderNo) {
      setMessage('️Please enter order number');
      return;
    }
    try {
      const name = await contract.methods.getName(viewOrderNo).call();
      if (!name || name === '') {
        setMessage('️Order not found');
        return;
      }
      const orderPrice = await contract.methods.getPrice(viewOrderNo).call();
      const refundTime = await contract.methods.getRefundWindow(viewOrderNo).call();
      
      setOrderDetails({
        name,
        price: web3.utils.fromWei(orderPrice, 'ether'),
      });
      setRefundWindow(refundTime);
      setMessage('Order details loaded');
    } catch (error) {
      console.error(error);
      setMessage('Error: ' + (error.message || 'Failed to load order'));
    }
  };

  const isCreator = currentAccount && creator && currentAccount.toLowerCase() === creator.toLowerCase();
  const isBuyer = currentAccount && buyer && currentAccount.toLowerCase() === buyer.toLowerCase();

  // If contract not loaded, show debugging info
  if (!contract) {
    return (
      <div className="app-root">
        <div className="invoice-card">
          <div className="header">
            <h1 className="title">Smart Contract</h1>
            <div className="meta">Network: {networkId || 'Not connected'}</div>
          </div>
          
          <div className="panel">
            <h3>Contract Not Loaded</h3>
            <p><strong>Network ID:</strong> {networkId || 'Not connected'}</p>
            <p><strong>Current Account:</strong> {currentAccount || 'Not connected'}</p>
            {message && (
              <div className={`message ${message.includes('❌') || message.includes('⚠️') ? 'error' : 'success'}`}>
                {message}
              </div>
            )}
            
            <div className="panel mt-15">
              <h4>Troubleshooting Steps</h4>
              <ol>
                <li>Make sure Ganache is running (port 7545 or 8545)</li>
                <li>Run: <code>truffle compile</code></li>
                <li>Run: <code>truffle migrate --reset</code></li>
                <li>Check that <code>client/src/contracts/Deal.json</code> exists</li>
                <li>Make sure MetaMask is connected to Ganache network:
                  <ul>
                    <li>Network Name: Ganache Local</li>
                    <li>RPC URL: http://127.0.0.1:7545</li>
                    <li>Chain ID: 1337 (or 5777)</li>
                  </ul>
                </li>
                <li>Import Ganache accounts into MetaMask using private keys</li>
                <li>Refresh this page</li>
              </ol>
            </div>
            
            <button 
              onClick={() => window.location.reload()} 
              className="btn mt-15"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="invoice-card">
        <div className="header">
          <h1 className="title">Smart Contract</h1>
          <div className="meta">
            <div style={{marginBottom: '4px'}}>16 June 2025</div>
            <div>Network ID: {networkId}</div>
          </div>
        </div>
        
        <div className="section panel">
          <h3>Billed to:</h3>
          <p><strong>Current Account:</strong> <code>{currentAccount}</code></p>
          <p><strong>Contract Address:</strong> <code>{contractAddress}</code></p>
          <p><strong>Role:</strong> {isCreator ? 'Creator' : isBuyer ? 'Buyer' : 'Observer'}</p>
          
          <div style={{marginTop: '24px'}}>
            <h3>Contract Information:</h3>
            <p><strong>Creator:</strong> <code>{creator}</code></p>
            <p><strong>Buyer:</strong> <code>{buyer}</code></p>
          </div>
        </div>

        {message && (
          <div className={`message ${message.includes('❌') || message.includes('⚠️') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        {isBuyer && (
          <div className="invoice-section">
            <div className="invoice-header">
              <div className="invoice-header-label">Buyer Functions</div>
            </div>
            
            <div className="invoice-row">
              <div className="invoice-row-label">1. Send Order</div>
              <div className="invoice-row-input">
                <input
                  type="text"
                  placeholder="Game name"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  className="input-field"
                  style={{width: '100%'}}
                />
              </div>
              <div className="invoice-row-action">
                <button onClick={sendOrder} disabled={loading} className="btn">
                  {loading ? '⏳ Sending...' : 'Send Order'}
                </button>
              </div>
            </div>

            <div className="invoice-row">
              <div className="invoice-row-label">2. Send Payment</div>
              <div className="invoice-row-input">
                <input
                  type="number"
                  placeholder="Order number"
                  value={paymentOrderNo}
                  onChange={(e) => setPaymentOrderNo(e.target.value)}
                  className="input-field"
                  style={{width: '100%'}}
                />
              </div>
              <div className="invoice-row-action">
                <button onClick={sendPayment} disabled={loading} className="btn">
                  {loading ? '⏳ Processing...' : 'Send Payment'}
                </button>
              </div>
            </div>

            <div className="invoice-row">
              <div className="invoice-row-label">3. Request Refund</div>
              <div className="invoice-row-input">
                <input
                  type="number"
                  placeholder="Order number"
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  className="input-field"
                  style={{width: '100%'}}
                />
              </div>
              <div className="invoice-row-action">
                <button onClick={returnProduct} disabled={loading} className="btn">
                  {loading ? '⏳ Processing...' : 'Return Product'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isCreator && (
          <div className="invoice-section">
            <div className="invoice-header">
              <div className="invoice-header-label">Creator Functions</div>
            </div>
          
            <div className="invoice-row">
              <div className="invoice-row-label">1. Confirm Order</div>
              <div className="invoice-row-input">
                <input
                  type="number"
                  placeholder="Order #"
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  className="input-field"
                  style={{width: '45%'}}
                />
                <input
                  type="text"
                  placeholder="Price (ETH)"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="input-field"
                  style={{width: '45%'}}
                />
              </div>
              <div className="invoice-row-action">
                <button onClick={confirmOrder} disabled={loading} className="btn">
                  {loading ? '⏳ Confirming...' : 'Confirm Order'}
                </button>
              </div>
            </div>

            <div className="invoice-row">
              <div className="invoice-row-label">2. Request Payout</div>
              <div className="invoice-row-input">
                <input
                  type="number"
                  placeholder="Order number"
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  className="input-field"
                  style={{width: '100%'}}
                />
              </div>
              <div className="invoice-row-action">
                <button onClick={requestPayout} disabled={loading} className="btn">
                  {loading ? '⏳ Processing...' : 'Request Payout'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="invoice-section">
          <div className="invoice-header">
            <div className="invoice-header-label">View Order Details</div>
          </div>
          
          <div className="invoice-row">
            <div className="invoice-row-label">Order Lookup</div>
            <div className="invoice-row-input">
              <input
                type="number"
                placeholder="Order number"
                value={viewOrderNo}
                onChange={(e) => setViewOrderNo(e.target.value)}
                className="input-field"
                style={{width: '100%'}}
              />
            </div>
            <div className="invoice-row-action">
              <button onClick={viewOrder} className="btn">
                View Order
              </button>
            </div>
          </div>

          {orderDetails && (
            <div className="order-details-table">
              <div className="order-detail-row">
                <div className="order-detail-label">Description</div>
                <div className="order-detail-value">{orderDetails.name}</div>
              </div>
              <div className="order-detail-row">
                <div className="order-detail-label">Rate</div>
                <div className="order-detail-value">{orderDetails.price} ETH</div>
              </div>
              <div className="order-detail-row">
                <div className="order-detail-label">Refund Window</div>
                <div className="order-detail-value">{refundWindow}s</div>
              </div>
              
              <div className="invoice-subtotal">
                <div className="subtotal-row">
                  <div className="subtotal-label">Subtotal</div>
                  <div className="subtotal-value">{orderDetails.price} ETH</div>
                </div>
                <div className="subtotal-row">
                  <div className="subtotal-label">Tax (0%)</div>
                  <div className="subtotal-value">0 ETH</div>
                </div>
                <div className="subtotal-row total-row">
                  <div className="subtotal-label">Total</div>
                  <div className="subtotal-value">{orderDetails.price} ETH</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="panel mt-30">
          <h4>📋 Testing Flow</h4>
          <ol>
            <li>Switch to <strong>Buyer</strong> account in MetaMask</li>
            <li><strong>Buyer:</strong> Send an order (enter game name like "Elden Ring")</li>
            <li>Switch to <strong>Creator</strong> account</li>
            <li><strong>Creator:</strong> Confirm order (enter order #1 and price like "0.01")</li>
            <li>Switch to <strong>Buyer</strong> account</li>
            <li><strong>Buyer:</strong> Send payment (order #1)</li>
            <li><strong>Option A:</strong> Request refund immediately (within 30 sec)</li>
            <li><strong>Option B:</strong> Wait 30+ seconds, switch to Creator, request payout</li>
          </ol>
        </div>
      </div>
    </div>
  );
}