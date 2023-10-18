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
