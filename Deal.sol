pragma solidity ^0.8.30;

contract Deal {

address public creator;
address public buyer;

uint timer = 30;

struct Order {
    string game;
    uint price;
    uint date;

    bool paid;
    uint refundDeadline;
}

mapping (uint => Order) orders;
uint orderseq;

event OrderSent (address buyer, string game, uint orderno);
event PaymentReceived (address buyer, uint orderno, uint price, uint time);
event CountdownStarted (uint orderno, uint start, uint end);
event CountdownEnded (uint orderno, uint time);
event RefundSuccessful (uint orderno, address buyer, uint time);
event PayoutSuccessful (uint orderno, address creator, uint amount, uint time);
event OrderSuccessful (uint orderno, uint time);

constructor (address _buyerAddr) payable {
    
    /// The seller is the contract's owner
    creator = msg.sender;

    buyer = _buyerAddr;
  }

function sendOrder(string calldata game) payable external  {
    
    /// Accept orders just from buyer
    require(msg.sender == buyer, "Only buyer can send an order");

    /// Increment the order sequence
    orderseq++;

    /// Create the order register
    orders[orderseq] = Order(game, 0, block.timestamp, false, 0);

    /// Trigger the event
    emit OrderSent(msg.sender, game, orderseq);
  }

  function SendPayment(uint orderno) payable public {

    /// Just the buyer can make safepay
    require(buyer == msg.sender, "Only buyer can refund");

    require(orders[orderno].price == msg.value, "Send the exact price");

    orders[orderno].paid = true;

    emit PaymentReceived(msg.sender, orderno, msg.value, block.timestamp);

    orders[orderno].refundDeadline = block.timestamp + timer;

    emit CountdownStarted(orderno, block.timestamp, timer);
  }

  function ReturnProduct(uint orderno) payable public {

    require(msg.sender == buyer, "Only buyer can refund");
    require(orders[orderno].paid, "Order not paid");
    require(orders[orderno].refundDeadline >= block.timestamp, "Cannot refund after the deadline");

    uint amount = orders[orderno].price;
    orders[orderno].paid = false;

    (bool success, ) = payable(buyer).call{value: amount}("");
    require(success, "Refund failed");

    emit RefundSuccessful(orderno, buyer, block.timestamp);
  }

  function Payout(uint orderno) payable public {

    require(msg.sender == creator, "Only creator can get the payout");
    require(orders[orderno].paid, "Order must be paid in order to receive the payout");
    require(orders[orderno].refundDeadline <= block.timestamp, "Cannot receive the payout before the deadline");

    uint amount = orders[orderno].price;
    orders[orderno].paid = false;

    (bool success, ) = payable(creator).call{value: amount}("");
    require(success, "Payout failed");

    emit PayoutSuccessful(orderno, creator, amount, block.timestamp);
    emit OrderSuccessful(orderno, block.timestamp);
  }
}