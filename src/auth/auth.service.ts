import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerUserDto: RegisterUserDto): Promise<User> {
    const hashPasswordBcrypt = await this.hashPassword(
      registerUserDto.password,
    );
    return await this.userRepository.save({
      ...registerUserDto,
      password: hashPasswordBcrypt,
      refresh_token: 'PQK',
    });
  }

  async login(loginUserDto: LoginUserDto): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { email: loginUserDto.email },
    });

    if (!user) {
      throw new HttpException(
        'Incorrect account or password',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const checkPass = bcrypt.compareSync(loginUserDto.password, user.password);
    if (!checkPass) {
      throw new HttpException(
        'Incorrect account or password',
        HttpStatus.UNAUTHORIZED,
      );
    }
    // generate access token and refresh token
    const payload = { id: user.id, email: user.email };
    return this.generateToken(payload);
  }
  async refreshToken(refresh_token: string): Promise<any> {
    try {
      const verify = await this.jwtService.verify(refresh_token, {
        secret: this.configService.get<string>('SECRET'),
      });
      const checkExitsToken = await this.userRepository.findOneBy({
        email: verify.email,
        refresh_token: verify.refresh_token,
      });
      if (checkExitsToken) {
        return this.generateToken({ id: verify.id, email: verify.email });
      } else {
        throw new HttpException(
          'Refresh token is not valid',
          HttpStatus.BAD_REQUEST,
        );
      }
    } catch (error) {
      throw new HttpException(
        'Refresh token is not valid',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  private async generateToken(payload: { id: number; email: string }) {
    const access_token = await this.jwtService.signAsync(payload);
    const refresh_token = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('SECRET'),
      expiresIn: this.configService.get<string>('EXPIRES_IN_REFRESH_TOKEN'),
    });
    await this.userRepository.update(
      {
        email: payload.email,
      },
      { refresh_token: refresh_token },
    );
    return { access_token, refresh_token };
  }
  private async hashPassword(password: string): Promise<string> {
    const saltRound = 10;
    const salt = await bcrypt.genSalt(saltRound);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  }
}
