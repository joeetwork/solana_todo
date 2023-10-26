use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct UserProfile {
    pub authority: Pubkey,
    pub github: String,
    pub last_repo: u8,
    pub repo_count: u8
}

#[account]
#[derive(Default)]
pub struct UserRepos {
    pub authority: Pubkey,
    pub repo: String,
    pub last_todo: u8,
    pub todo_count: u8
}

#[account]
#[derive(Default)]
pub struct UserTickets {
    pub authority: Pubkey,
    pub content: String,
    pub marked: bool,
}

#[account]
#[derive(Default)]
pub struct EscrowState {
    pub random_seed: u64,
    pub initializer_key: Pubkey,
    pub initializer_deposit_token_account: Pubkey,
    pub initializer_receive_token_account: Pubkey,
    pub initializer_amount: u64,
    pub taker_amount: u64,
    pub vault_authority_bump: u8,
}

impl EscrowState {
    pub fn space() -> usize {
        8 + 121
    }
}
