#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env, String, Symbol, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    InvalidAmount = 2,
    InvalidTimeRange = 3,
    InvalidStartTime = 4,
    StreamNotFound = 5,
    StreamNotActive = 6,
    StreamNotTransferable = 7,
    NFTNotFound = 8,
    NoTokensToClaim = 9,
    Unauthorized = 10,
}

#[contracttype]
#[derive(Clone, Debug, Copy, PartialEq, Eq)]
pub enum StreamStatus {
    Active,
    Paused,
    Canceled,
    Completed,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Stream {
    pub id: u64,
    pub sender: Address,
    pub recipient: Address,
    pub token: Address,
    pub total_amount: i128,
    pub withdrawn_amount: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub status: StreamStatus,
    pub transferable: bool,
    pub nft_id: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct StreamNFT {
    pub stream_id: u64,
    pub owner: Address,
    pub minted_at: u64,
}

// Storage keys
#[contracttype]
pub enum DataKey {
    StreamCounter,
    NFTCounter,
    Stream(u64),
    StreamNFT(u64),
    NFTToStream(u64),
    Admin,
    NFTName,
    NFTSymbol,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct StreamCreatedEvent {
    pub stream_id: u64,
    pub sender: Address,
    pub recipient: Address,
    pub token: Address,
    pub total_amount: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub transferable: bool,
    pub nft_id: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct StreamTransferredEvent {
    pub stream_id: u64,
    pub nft_id: u64,
    pub from: Address,
    pub to: Address,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct StreamClaimedEvent {
    pub stream_id: u64,
    pub recipient: Address,
    pub amount: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct StreamCancelledEvent {
    pub stream_id: u64,
    pub sender: Address,
    pub refund_amount: i128,
    pub timestamp: u64,
}

#[contract]
pub struct PaymentStreamContract;

#[contractimpl]
impl PaymentStreamContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        nft_name: String,
        nft_symbol: String,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NFTName, &nft_name);
        env.storage()
            .instance()
            .set(&DataKey::NFTSymbol, &nft_symbol);
        env.storage().instance().set(&DataKey::StreamCounter, &0u64);
        env.storage().instance().set(&DataKey::NFTCounter, &0u64);

        Ok(())
    }

    pub fn create_stream(
        env: Env,
        sender: Address,
        recipient: Address,
        token: Address,
        total_amount: i128,
        start_time: u64,
        end_time: u64,
        transferable: bool,
    ) -> Result<u64, Error> {
        sender.require_auth();

        if total_amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if start_time >= end_time {
            return Err(Error::InvalidTimeRange);
        }
        if start_time < env.ledger().timestamp() {
            return Err(Error::InvalidStartTime);
        }

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &total_amount);

        let stream_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::StreamCounter)
            .unwrap_or(0);
        let new_stream_id = stream_id + 1;
        env.storage()
            .instance()
            .set(&DataKey::StreamCounter, &new_stream_id);

        let nft_id = Self::mint_nft(env.clone(), recipient.clone(), new_stream_id);

        let stream = Stream {
            id: new_stream_id,
            sender: sender.clone(),
            recipient: recipient.clone(),
            token: token.clone(),
            total_amount,
            withdrawn_amount: 0,
            start_time,
            end_time,
            status: StreamStatus::Active,
            transferable,
            nft_id,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Stream(new_stream_id), &stream);

        env.events().publish(
            (Symbol::new(&env, "stream_created"),),
            StreamCreatedEvent {
                stream_id: new_stream_id,
                sender: sender.clone(),
                recipient,
                token,
                total_amount,
                start_time,
                end_time,
                transferable,
                nft_id,
            },
        );

        Ok(new_stream_id)
    }

    pub fn transfer_stream(env: Env, stream_id: u64, new_recipient: Address) -> Result<(), Error> {
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&DataKey::Stream(stream_id))
            .ok_or(Error::StreamNotFound)?;

        if stream.status != StreamStatus::Active {
            return Err(Error::StreamNotActive);
        }

        if !stream.transferable {
            return Err(Error::StreamNotTransferable);
        }

        let nft_id = stream.nft_id;
        let mut nft: StreamNFT = env
            .storage()
            .persistent()
            .get(&DataKey::StreamNFT(nft_id))
            .ok_or(Error::NFTNotFound)?;

        nft.owner.require_auth();

        let old_recipient = stream.recipient.clone();

        stream.recipient = new_recipient.clone();
        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);

        nft.owner = new_recipient.clone();
        env.storage()
            .persistent()
            .set(&DataKey::StreamNFT(nft_id), &nft);

        env.events().publish(
            (Symbol::new(&env, "stream_transferred"),),
            StreamTransferredEvent {
                stream_id,
                nft_id,
                from: old_recipient,
                to: new_recipient,
                timestamp: env.ledger().timestamp(),
            },
        );

        Ok(())
    }

    pub fn claim(env: Env, stream_id: u64) -> Result<i128, Error> {
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&DataKey::Stream(stream_id))
            .ok_or(Error::StreamNotFound)?;

        if stream.status != StreamStatus::Active {
            return Err(Error::StreamNotActive);
        }

        let nft: StreamNFT = env
            .storage()
            .persistent()
            .get(&DataKey::StreamNFT(stream.nft_id))
            .ok_or(Error::NFTNotFound)?;

        nft.owner.require_auth();

        let current_time = env.ledger().timestamp();
        let claimable = Self::calculate_claimable(&stream, current_time);

        if claimable <= 0 {
            return Err(Error::NoTokensToClaim);
        }

        stream.withdrawn_amount += claimable;

        if stream.withdrawn_amount >= stream.total_amount {
            stream.status = StreamStatus::Completed;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);

        let token_client = token::Client::new(&env, &stream.token);
        token_client.transfer(&env.current_contract_address(), &nft.owner, &claimable);

        env.events().publish(
            (Symbol::new(&env, "stream_claimed"),),
            StreamClaimedEvent {
                stream_id,
                recipient: nft.owner,
                amount: claimable,
                timestamp: current_time,
            },
        );

        Ok(claimable)
    }

    pub fn cancel_stream(env: Env, stream_id: u64) -> Result<(), Error> {
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&DataKey::Stream(stream_id))
            .ok_or(Error::StreamNotFound)?;

        if stream.status != StreamStatus::Active {
            return Err(Error::StreamNotActive);
        }

        stream.sender.require_auth();

        let current_time = env.ledger().timestamp();
        let vested = Self::calculate_vested(&stream, current_time);
        let refund_amount = stream.total_amount - vested;

        stream.status = StreamStatus::Canceled;
        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);

        if refund_amount > 0 {
            let token_client = token::Client::new(&env, &stream.token);
            token_client.transfer(
                &env.current_contract_address(),
                &stream.sender,
                &refund_amount,
            );
        }

        env.events().publish(
            (Symbol::new(&env, "stream_cancelled"),),
            StreamCancelledEvent {
                stream_id,
                sender: stream.sender,
                refund_amount,
                timestamp: current_time,
            },
        );

        Ok(())
    }

    pub fn get_stream(env: Env, stream_id: u64) -> Result<Stream, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Stream(stream_id))
            .ok_or(Error::StreamNotFound)
    }

    pub fn get_nft(env: Env, nft_id: u64) -> Result<StreamNFT, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::StreamNFT(nft_id))
            .ok_or(Error::NFTNotFound)
    }

    pub fn nft_owner(env: Env, nft_id: u64) -> Result<Address, Error> {
        let nft: StreamNFT = env
            .storage()
            .persistent()
            .get(&DataKey::StreamNFT(nft_id))
            .ok_or(Error::NFTNotFound)?;
        Ok(nft.owner)
    }

    pub fn get_claimable(env: Env, stream_id: u64) -> Result<i128, Error> {
        let stream: Stream = env
            .storage()
            .persistent()
            .get(&DataKey::Stream(stream_id))
            .ok_or(Error::StreamNotFound)?;

        if stream.status != StreamStatus::Active {
            return Ok(0);
        }

        Ok(Self::calculate_claimable(&stream, env.ledger().timestamp()))
    }

    fn mint_nft(env: Env, recipient: Address, stream_id: u64) -> u64 {
        let nft_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NFTCounter)
            .unwrap_or(0);
        let new_nft_id = nft_id + 1;

        env.storage()
            .instance()
            .set(&DataKey::NFTCounter, &new_nft_id);

        let nft = StreamNFT {
            stream_id,
            owner: recipient,
            minted_at: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::StreamNFT(new_nft_id), &nft);
        env.storage()
            .persistent()
            .set(&DataKey::NFTToStream(new_nft_id), &stream_id);

        new_nft_id
    }

    fn calculate_vested(stream: &Stream, current_time: u64) -> i128 {
        if current_time < stream.start_time {
            return 0;
        }

        if current_time >= stream.end_time {
            return stream.total_amount;
        }

        let elapsed = current_time - stream.start_time;
        let duration = stream.end_time - stream.start_time;

        (stream.total_amount * elapsed as i128) / duration as i128
    }

    fn calculate_claimable(stream: &Stream, current_time: u64) -> i128 {
        let vested = Self::calculate_vested(stream, current_time);
        vested - stream.withdrawn_amount
    }
}
